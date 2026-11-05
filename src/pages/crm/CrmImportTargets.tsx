import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type TargetRow = { name: string; phone: string; idType: string; idNumber: string; city: string; notes: string };
type ResultRow = TargetRow & { status: string };

const HEADER_MAP: Record<string, keyof TargetRow> = {
  "الاسم": "name", "اسم": "name", "name": "name",
  "الجوال": "phone", "جوال": "phone", "الهاتف": "phone", "phone": "phone",
  "نوع الهوية": "idType", "id_type": "idType",
  "رقم الهوية": "idNumber", "السجل": "idNumber", "id_number": "idNumber",
  "المدينة": "city", "city": "city",
  "ملاحظات": "notes", "notes": "notes",
};

export default function CrmImportTargets() {
  const { isAdmin, isLeasingManager, isSalesAgent, loading } = useAuth();
  const allowed = isAdmin || isLeasingManager || isSalesAgent;
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [owner, setOwner] = useState("");
  const [running, setRunning] = useState(false);

  const agentsQ = useQuery({
    queryKey: ["crm-agents"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "sales_agent").eq("is_active", true);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; display_name: string }[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      return ids.map((user_id) => ({ user_id, display_name: profiles?.find((p) => p.user_id === user_id)?.display_name ?? "وسيط" }));
    },
  });

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: TargetRow[] = raw.map((r) => {
        const out: TargetRow = { name: "", phone: "", idType: "", idNumber: "", city: "", notes: "" };
        for (const [k, v] of Object.entries(r)) {
          const key = HEADER_MAP[k.trim()];
          if (key) out[key] = String(v).trim();
        }
        return out;
      }).filter((r) => r.name);
      if (parsed.length === 0) { toast.error("لم يُعثر على صفوف صالحة — الأعمدة المطلوبة: الاسم، الجوال"); return; }
      setRows(parsed);
      setResults([]);
      toast.success(`تم قراءة ${parsed.length} صف`);
    } catch {
      toast.error("تعذر قراءة الملف");
    }
  };

  const apply = async () => {
    setRunning(true);
    const out: ResultRow[] = [];
    for (const r of rows) {
      try {
        const { data: partyRes, error: partyErr } = await supabase.rpc("create_party", {
          _name_ar: r.name,
          _party_type: r.idType === "commercial_registration" ? ("company" as never) : ("individual" as never),
          _id_type: r.idType || null,
          _id_number: r.idNumber || null,
          _phone: r.phone || null,
          _city: r.city || null,
          _source: "target_list",
        });
        if (partyErr) throw partyErr;
        const res = partyRes as { status: string; party: { id: string } };
        if (res.status === "exists") {
          out.push({ ...r, status: "موجود مسبقًا — لم تُنشأ فرصة" });
          continue;
        }
        const { error: oppErr } = await supabase.rpc("create_opportunity", {
          _party_id: res.party.id,
          _source: "target_list" as never,
          _owner_user_id: owner || null,
          _notes: r.notes || null,
        });
        if (oppErr) throw oppErr;
        out.push({ ...r, status: "أُنشئت فرصة جديدة" });
      } catch (e) {
        out.push({ ...r, status: `خطأ: ${e instanceof Error ? e.message : "غير معروف"}` });
      }
      setResults([...out]);
    }
    setRunning(false);
    toast.success("انتهى الاستيراد");
  };

  return (
    <main dir="rtl" className="container-tight space-y-5 py-8">
      <h1 className="text-2xl font-bold">استيراد قائمة مستهدفة</h1>
      <p className="text-sm text-muted-foreground">ارفع CSV أو Excel بأعمدة: الاسم، الجوال، نوع الهوية، رقم الهوية، المدينة، ملاحظات. كل صف يصبح عميلًا + فرصة «جديد» بمصدر «قائمة مستهدفة».</p>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} className="text-sm" />
        <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">المالك: أنا / توزيع بالدور</option>
          {(agentsQ.data ?? []).map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
        </select>
        <Button disabled={rows.length === 0 || running} onClick={apply}>{running ? "جارٍ الاستيراد…" : `اعتماد ${rows.length} صف`}</Button>
      </div>

      {rows.length > 0 && results.length === 0 && (
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الجوال</TableHead><TableHead>الهوية</TableHead><TableHead>المدينة</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((r, i) => (
              <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{r.idNumber}</TableCell><TableCell>{r.city}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {results.length > 0 && (
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الجوال</TableHead><TableHead>النتيجة</TableHead></TableRow></TableHeader>
          <TableBody>
            {results.map((r, i) => (
              <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell>{r.phone}</TableCell><TableCell>{r.status}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
