import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Navigate, Link } from "react-router-dom";
import { AlertTriangle, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportRowsToExcel } from "@/lib/exportData";

const ISSUES: Record<string, string> = {
  no_building: "بدون مبنى",
  no_activity: "بدون نشاط",
  no_area: "بدون مساحة",
  activity_not_in_building: "النشاط مش من أنشطة المبنى",
  type_conflict: "النوع لا يطابق النشاط",
};
const PAGE = 50;

type Row = { id: string; building_number: number | null; unit_number: number; unit_type: string | null; area_m2: number | null; status: string; publish_state: string; is_test: boolean; activity_name: string | null; issues: string[] };

export default function AdminUnitsIncomplete() {
  const { isAdmin, isManager, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [issue, setIssue] = useState("all");
  const [busy, setBusy] = useState(false);

  const fetchPage = async (limit: number, offset: number) => {
    const { data, error } = await supabase.rpc("admin_units_needing_completion", {
      _search: search.trim() || null, _issue: issue === "all" ? null : issue, _limit: limit, _offset: offset,
    } as any);
    if (error) throw error;
    return data as { total: number; as_of: string; rows: Row[] };
  };

  const load = async () => {
    setBusy(true);
    try {
      const d = await fetchPage(PAGE, page * PAGE);
      setRows(d.rows); setTotal(d.total); setAsOf(d.as_of);
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (isAdmin || isManager) load(); }, [isAdmin, isManager, page, issue]);

  if (loading) return null;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;

  const exportAll = async () => {
    let request:string|undefined;
    try {
      const start=await supabase.rpc("request_admin_export",{_list:"units_incomplete",_format:"xlsx",_scope:{search,issue}});if(start.error)throw start.error;
      request=String(start.data);
      const entries:Row[]=[];let as_of="";for(let offset=0;;offset+=500){const part=await fetchPage(500,offset);entries.push(...part.rows);as_of=part.as_of;if(part.rows.length<500)break;}
      const d={rows:entries,total:entries.length,as_of};
      exportRowsToExcel(
        d.rows.map((r) => ({ "المبنى": r.building_number ?? "", "الوحدة": r.unit_number, "النوع": r.unit_type ?? "", "النشاط": r.activity_name ?? "", "المساحة م²": r.area_m2 ?? "", "المشاكل": r.issues.map((i) => ISSUES[i] ?? i).join("، "), "النشر": r.publish_state, "تجريبية": r.is_test ? "نعم" : "لا" })),
        "units_needing_completion", "وحدات تحتاج استكمال",
        [{ "النطاق": "المشروع كامل", "الفلتر": issue === "all" ? "الكل" : ISSUES[issue], "البحث": search || "—", "وقت التحديث": new Date(d.as_of).toLocaleString("ar-SA"), "العدد": d.total }],
      );
      const done=await supabase.rpc("complete_admin_export",{_id:request,_status:"generated",_count:d.total});if(done.error)throw done.error;
    } catch (e: any) { if(request)await supabase.rpc("complete_admin_export",{_id:request,_status:"failed",_count:0});toast.error(e.message); }
  };

  return (
    <><Header/><main className="container-tight space-y-6 py-8" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">وحدات تحتاج استكمال</h1>
            <p className="text-xs text-muted-foreground">النطاق: المشروع كامل · محدث {asOf ? new Date(asOf).toLocaleString("ar-SA") : "—"}</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportAll} disabled={!total}><Download className="h-4 w-4" />تصدير Excel</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>العدد: <span className="num">{total}</span></CardTitle>
          <CardDescription>الوحدات اللي ناقصها مبنى أو نشاط أو مساحة، أو نشاطها أو نوعها متعارض. الوحدة دي ما ينفعش تتنشر لحد ما تتستكمل.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }}>
              <Input placeholder="رقم مبنى أو وحدة أو نشاط" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
              <Button type="submit" variant="secondary"><Search className="h-4 w-4" /></Button>
            </form>
            <Select value={issue} onValueChange={(v) => { setIssue(v); setPage(0); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل المشاكل</SelectItem>{Object.entries(ISSUES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>المبنى</TableHead><TableHead>الوحدة</TableHead><TableHead>النوع</TableHead><TableHead>النشاط</TableHead><TableHead>المساحة م²</TableHead><TableHead>المشاكل</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="num">{r.building_number ?? "—"}</TableCell>
                      <TableCell className="num font-bold"><Link className="text-primary hover:underline" to={`/admin/units/${r.id}`}>{r.unit_number}</Link>{r.is_test && <Badge variant="outline" className="mr-2">تجريبية</Badge>}</TableCell>
                      <TableCell>{r.unit_type ?? "—"}</TableCell>
                      <TableCell>{r.activity_name ?? "—"}</TableCell>
                      <TableCell className="num">{r.area_m2 ?? "—"}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{r.issues.map((i) => <Badge key={i} variant="destructive">{ISSUES[i] ?? i}</Badge>)}</div></TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">مفيش وحدات ناقصة بيانات</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </div>
          {total > PAGE && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button>
              <span className="num">{page + 1} / {Math.ceil(total / PAGE)}</span>
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>التالي</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main></>
  );
}
