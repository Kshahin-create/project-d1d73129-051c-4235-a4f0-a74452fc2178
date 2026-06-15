import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, Download, RotateCcw, Trash2, Plus, Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Backup = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  table_counts: Record<string, number>;
  kind: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export default function AdminBackup() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const totals = useMemo(() => {
    const totalSize = backups.reduce((s, b) => s + (b.size_bytes || 0), 0);
    const lastAt = backups[0]?.created_at;
    return { count: backups.length, totalSize, lastAt };
  }, [backups]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("system-backup", { body: { action: "list" } });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data?.error) { toast.error(data.error); return; }
    setBackups(data?.backups ?? []);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!isAdmin) return;
    load();
  }, [authLoading, user, isAdmin]);

  async function createBackup() {
    setCreating(true);
    const t = toast.loading("جاري إنشاء النسخة الاحتياطية… قد يستغرق دقيقة");
    const { data, error } = await supabase.functions.invoke("system-backup", {
      body: { action: "create", name: name || undefined, notes: notes || undefined },
    });
    toast.dismiss(t);
    setCreating(false);
    if (error || data?.error) { toast.error(error?.message || data?.error); return; }
    toast.success("تم إنشاء النسخة الاحتياطية");
    setName(""); setNotes("");
    load();
  }

  async function downloadBackup(id: string, name: string) {
    const { data, error } = await supabase.functions.invoke("system-backup", { body: { action: "download", id } });
    if (error || data?.error) { toast.error(error?.message || data?.error); return; }
    const a = document.createElement("a");
    a.href = data.url; a.download = `${name}.json`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function deleteBackup(id: string) {
    const { data, error } = await supabase.functions.invoke("system-backup", { body: { action: "delete", id } });
    if (error || data?.error) { toast.error(error?.message || data?.error); return; }
    toast.success("تم الحذف");
    load();
  }

  async function restoreBackup(id: string) {
    setRestoringId(id);
    const t = toast.loading("جاري الاسترجاع… سيتم إنشاء نسخة تلقائية قبل الاسترجاع");
    const { data, error } = await supabase.functions.invoke("system-backup", { body: { action: "restore", id } });
    toast.dismiss(t);
    setRestoringId(null);
    if (error || data?.error) { toast.error(error?.message || data?.error); return; }
    toast.success("تم الاسترجاع بنجاح");
    load();
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-destructive" /> ممنوع</CardTitle>
            <CardDescription>هذه الصفحة للمشرف العام فقط.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline"><Link to="/">العودة للرئيسية</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Database className="w-7 h-7 text-primary" /> النسخ الاحتياطي والاسترجاع</h1>
            <p className="text-muted-foreground text-sm mt-1">نسخة كاملة من قاعدة البيانات — تشمل كل الجداول الأساسية. كل تعديل جديد بيتسجّل، واعمل نسخة جديدة وقت ما تحب.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/admin">رجوع <ArrowRight className="w-4 h-4 mr-1" /></Link></Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>عدد النسخ</CardDescription><CardTitle className="text-3xl">{totals.count}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>إجمالي الحجم</CardDescription><CardTitle className="text-3xl">{fmtBytes(totals.totalSize)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>آخر نسخة</CardDescription><CardTitle className="text-base">{totals.lastAt ? new Date(totals.lastAt).toLocaleString("ar-EG") : "—"}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> إنشاء نسخة احتياطية جديدة</CardTitle>
            <CardDescription>هتحفظ كل بيانات السيستم الحالية في ملف JSON داخل تخزين آمن.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="اسم النسخة (اختياري)" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
            </div>
            <Button onClick={createBackup} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إنشاء نسخة الآن
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سجل النسخ الاحتياطية</CardTitle>
            <CardDescription>كل نسخة تقدر تنزّلها أو ترجع السيستم لحظتها. الاسترجاع بيعمل نسخة تلقائية للحالة الحالية الأول.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : backups.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">لا توجد نسخ بعد.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحجم</TableHead>
                      <TableHead className="text-right">عدد السجلات</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((b) => {
                      const total = Object.values(b.table_counts || {}).reduce((s, n) => s + (n || 0), 0);
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div className="font-medium">{b.name}</div>
                            {b.notes && <div className="text-xs text-muted-foreground">{b.notes}</div>}
                          </TableCell>
                          <TableCell><Badge variant={b.kind === "auto" ? "secondary" : "default"}>{b.kind === "auto" ? "تلقائي" : "يدوي"}</Badge></TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(b.created_at).toLocaleString("ar-EG")}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtBytes(b.size_bytes)}</TableCell>
                          <TableCell>
                            <details>
                              <summary className="cursor-pointer text-sm">{total.toLocaleString("ar-EG")}</summary>
                              <div className="mt-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                                {Object.entries(b.table_counts || {}).map(([t, n]) => (
                                  <div key={t} className="flex justify-between gap-4"><span className="text-muted-foreground">{t}</span><span>{n}</span></div>
                                ))}
                              </div>
                            </details>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => downloadBackup(b.id, b.name)} className="gap-1"><Download className="w-3.5 h-3.5" />تحميل</Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="secondary" className="gap-1" disabled={restoringId === b.id}>
                                    {restoringId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                    استرجاع
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الاسترجاع</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هيتم استبدال كل بيانات السيستم بالبيانات الموجودة في النسخة «{b.name}». هنعمل نسخة تلقائية للحالة الحالية قبل الاسترجاع.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => restoreBackup(b.id)}>متابعة الاسترجاع</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" className="gap-1"><Trash2 className="w-3.5 h-3.5" />حذف</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>حذف النسخة؟</AlertDialogTitle>
                                    <AlertDialogDescription>لا يمكن التراجع بعد الحذف.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBackup(b.id)}>حذف</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
