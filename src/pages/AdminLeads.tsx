import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Pencil,
  Send,
  Copy,
  MessageCircle,
  Search,
  FileSpreadsheet,
  RefreshCw,
  CloudUpload,
  CloudDownload,
  ExternalLink,
} from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PhoneField } from "@/components/PhoneField";
import { copyToClipboard } from "@/lib/whatsapp";

type Lead = {
  id: string;
  full_name: string;
  phone: string;
  notes: string | null;
  status: string;
  last_message_at: string | null;
  last_message_text: string | null;
  created_at: string;
};

const STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "new", label: "جديد", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { value: "contacted", label: "تم التواصل", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { value: "interested", label: "مهتم", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { value: "not_interested", label: "غير مهتم", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  { value: "converted", label: "تحوّل لعميل", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
];

const DEFAULT_TEMPLATE =
  "السلام عليكم {name}،\nمعكم نخبة تسكين العقارية - المدينة الصناعية بشمال مكة.\nلدينا وحدات تجارية وصناعية متاحة قد تناسبكم.\nللاطلاع: https://www.mnicejar.com";

function normalizePhone(raw: string) {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "966" + d.slice(1);
  return d;
}

function renderTemplate(tpl: string, lead: Lead) {
  return tpl
    .split("{name}").join(lead.full_name || "")
    .split("{phone}").join(lead.phone || "")
    .split("{notes}").join(lead.notes || "");
}

const AdminLeads = () => {
  const { isAdmin, isManager, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [template, setTemplate] = useState<string>(() => {
    return localStorage.getItem("leads_msg_template") || DEFAULT_TEMPLATE;
  });
  const [editing, setEditing] = useState<Partial<Lead> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState("Leads");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"" | "push" | "pull" | "sync" | "save">("");

  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("leads_sheet_id, leads_sheet_name, leads_sheet_last_sync_at")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setSheetId(data.leads_sheet_id || "");
      setSheetName(data.leads_sheet_name || "Leads");
      setLastSync(data.leads_sheet_last_sync_at || null);
    }
  };

  function extractSheetId(input: string) {
    const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : input.trim();
  }

  const handleSaveSheet = async () => {
    setSyncing("save");
    const id = extractSheetId(sheetId);
    const { error } = await supabase
      .from("app_settings")
      .update({ leads_sheet_id: id || null, leads_sheet_name: sheetName || "Leads" })
      .eq("id", 1);
    setSyncing("");
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setSheetId(id);
    toast({ title: "تم حفظ إعدادات الشييت" });
  };

  const runSync = async (action: "push" | "pull" | "sync") => {
    setSyncing(action);
    const { data, error } = await supabase.functions.invoke("leads-sheets-sync", {
      body: { action },
    });
    setSyncing("");
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message || "حدث خطأ";
      return toast({ title: "فشلت المزامنة", description: msg, variant: "destructive" });
    }
    const r = data as { pushed: number; pulled: number; inserted: number; updated: number };
    toast({
      title: "تمت المزامنة",
      description:
        action === "push"
          ? `تم رفع ${r.pushed} صف`
          : action === "pull"
          ? `تمت قراءة ${r.pulled} (إضافة ${r.inserted}، تحديث ${r.updated})`
          : `رفع ${r.pushed} ✓`,
    });
    loadSettings();
    fetchLeads();
  };

  useEffect(() => {
    localStorage.setItem("leads_msg_template", template);
  }, [template]);

  const fetchLeads = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setLeads((data as Lead[]) || []);
    setBusy(false);
  };

  useEffect(() => {
    if (!loading && (isAdmin || isManager)) fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin, isManager]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!s) return true;
      return (
        l.full_name.toLowerCase().includes(s) ||
        l.phone.toLowerCase().includes(s) ||
        (l.notes || "").toLowerCase().includes(s)
      );
    });
  }, [leads, q, statusFilter]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;

  const handleSave = async () => {
    if (!editing) return;
    const name = (editing.full_name || "").trim();
    const phone = (editing.phone || "").trim();
    if (name.length < 2) {
      toast({ title: "اسم غير صالح", variant: "destructive" });
      return;
    }
    if (!phone || !isValidPhoneNumber(phone)) {
      toast({ title: "رقم جوال غير صحيح", variant: "destructive" });
      return;
    }
    const payload = {
      full_name: name,
      phone,
      notes: (editing.notes || "").trim() || null,
      status: editing.status || "new",
    };
    if (editing.id) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
      toast({ title: "تم الحفظ" });
    } else {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
      toast({ title: "تمت الإضافة" });
    }
    setEditing(null);
    fetchLeads();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذا المستهدف؟")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    toast({ title: "تم الحذف" });
    fetchLeads();
  };

  const handleSetStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    fetchLeads();
  };

  const handleSendWA = async (lead: Lead) => {
    const text = renderTemplate(template, lead);
    const to = normalizePhone(lead.phone);
    if (!to) return toast({ title: "رقم غير صالح", variant: "destructive" });
    const url = `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    await supabase
      .from("leads")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_text: text,
        status: lead.status === "new" ? "contacted" : lead.status,
      })
      .eq("id", lead.id);
    fetchLeads();
  };

  const handleCopy = async (lead: Lead) => {
    const ok = await copyToClipboard(renderTemplate(template, lead));
    toast({ title: ok ? "تم النسخ" : "فشل النسخ", variant: ok ? "default" : "destructive" });
  };

  const handleExport = () => {
    const rows = filtered.map((l) => ({
      الاسم: l.full_name,
      "رقم الجوال": l.phone,
      "ملاحظات": l.notes || "",
      "الحالة": STATUSES.find((s) => s.value === l.status)?.label || l.status,
      "آخر تواصل": l.last_message_at
        ? new Date(l.last_message_at).toLocaleString("ar-SA-u-nu-latn")
        : "",
      "تاريخ الإضافة": new Date(l.created_at).toLocaleString("ar-SA-u-nu-latn"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المستهدفون");
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "الاسم": "محمد عبدالله", "رقم الجوال": "+966555555555", "ملاحظات": "مهتم بوحدة 200م" },
      { "الاسم": "أحمد علي", "رقم الجوال": "+966500000000", "ملاحظات": "" },
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "leads-template.xlsx");
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      const rows = json
        .map((r) => {
          const name = String(
            r["الاسم"] ?? r["full_name"] ?? r["name"] ?? r["Name"] ?? "",
          ).trim();
          let phoneRaw = String(
            r["رقم الجوال"] ?? r["phone"] ?? r["Phone"] ?? r["جوال"] ?? "",
          ).trim();
          if (phoneRaw && !phoneRaw.startsWith("+")) {
            const d = normalizePhone(phoneRaw);
            if (d) phoneRaw = "+" + d;
          }
          const notes = String(r["ملاحظات"] ?? r["notes"] ?? r["Notes"] ?? "").trim();
          return { full_name: name, phone: phoneRaw, notes };
        })
        .filter((r) => r.full_name && r.phone && isValidPhoneNumber(r.phone));

      if (!rows.length) {
        toast({ title: "لا توجد صفوف صحيحة", description: "تأكد من أعمدة الاسم ورقم الجوال", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.rpc("import_leads", { _rows: rows as never });
      if (error) throw error;
      toast({ title: "تم الاستيراد", description: `تمت إضافة ${data ?? 0} مستهدف جديد` });
      fetchLeads();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "خطأ في الاستيراد", description: msg, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold">المستهدفون والرسائل</h1>
          <p className="text-sm text-muted-foreground">
            قائمة الأشخاص اللي تحب تبعتلهم رسائل عبر واتساب
          </p>
        </div>
      </div>

      {/* Message template */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <Label className="mb-2 block text-sm font-bold">قالب الرسالة</Label>
        <Textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          المتغيرات المتاحة: <code>{"{name}"}</code> · <code>{"{phone}"}</code> · <code>{"{notes}"}</code>
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing({ status: "new" })} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة مستهدف
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" /> استيراد Excel
        </Button>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> تصدير Excel
        </Button>
        <Button variant="ghost" onClick={handleDownloadTemplate} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> نموذج فارغ
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
          }}
        />
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث..."
            className="w-48 pr-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">الجوال</TableHead>
              <TableHead className="text-right">ملاحظات</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">آخر تواصل</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {busy && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            )}
            {!busy && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  لا توجد بيانات. ابدأ بإضافة مستهدف أو استورد ملف Excel.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((l) => {
              const st = STATUSES.find((s) => s.value === l.status);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.full_name}</TableCell>
                  <TableCell dir="ltr" className="text-right text-sm">
                    {l.phone}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {l.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.status}
                      onValueChange={(v) => handleSetStatus(l.id, v)}
                    >
                      <SelectTrigger className={`h-8 w-32 border-0 ${st?.cls || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.last_message_at
                      ? new Date(l.last_message_at).toLocaleString("ar-SA-u-nu-latn", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleSendWA(l)}
                        className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Send className="h-3.5 w-3.5" /> واتساب
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="نسخ الرسالة"
                        onClick={() => handleCopy(l)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="تعديل"
                        onClick={() => setEditing(l)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        title="حذف"
                        onClick={() => handleDelete(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        إجمالي: {filtered.length} من {leads.length}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "تعديل مستهدف" : "إضافة مستهدف"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input
                value={editing?.full_name || ""}
                onChange={(e) =>
                  setEditing((p) => ({ ...(p || {}), full_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الجوال</Label>
              <PhoneField
                value={editing?.phone || ""}
                onChange={(v) => setEditing((p) => ({ ...(p || {}), phone: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                rows={3}
                value={editing?.notes || ""}
                onChange={(e) =>
                  setEditing((p) => ({ ...(p || {}), notes: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select
                value={editing?.status || "new"}
                onValueChange={(v) => setEditing((p) => ({ ...(p || {}), status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeads;
