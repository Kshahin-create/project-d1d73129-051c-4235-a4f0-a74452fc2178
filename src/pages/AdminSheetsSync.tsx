import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CloudUpload, CloudDownload, ExternalLink, FileSpreadsheet, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const BUILDINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

export default function AdminSheetsSync() {
  const { isAdmin, isManager, loading } = useAuth();
  const [sheetId, setSheetId] = useState("");
  const [originalId, setOriginalId] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastDir, setLastDir] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>(BUILDINGS);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("buildings_sheet_id, buildings_sheet_last_sync_at, buildings_sheet_last_direction")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setSheetId(data.buildings_sheet_id || "");
        setOriginalId(data.buildings_sheet_id || "");
        setLastSync(data.buildings_sheet_last_sync_at);
        setLastDir(data.buildings_sheet_last_direction);
      }
    })();
  }, []);

  if (loading) return null;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;

  const saveId = async () => {
    setSaving(true);
    const id = extractSheetId(sheetId);
    const { error } = await supabase.from("app_settings").update({ buildings_sheet_id: id || null }).eq("id", 1);
    setSaving(false);
    if (error) return toast({ title: "خطأ في الحفظ", description: error.message, variant: "destructive" });
    setSheetId(id);
    setOriginalId(id);
    toast({ title: "تم الحفظ" });
  };

  const run = async (action: "push" | "pull") => {
    if (!originalId) return toast({ title: "احفظ معرّف الشييت أولاً", variant: "destructive" });
    if (selected.length === 0) return toast({ title: "اختر مبنى واحد على الأقل", variant: "destructive" });
    setBusy(action);
    const { data, error } = await supabase.functions.invoke("buildings-sheets-sync", {
      body: { action, buildings: selected },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      return toast({
        title: action === "push" ? "فشل الرفع للشييت" : "فشل السحب من الشييت",
        description: (data as any)?.error || error?.message,
        variant: "destructive",
      });
    }
    const d = data as any;
    toast({
      title: action === "push" ? "تم الرفع بنجاح" : "تم السحب بنجاح",
      description: action === "push"
        ? `تم رفع ${d.pushed} وحدة على ${selected.length} مبنى`
        : `تم تحديث ${d.updated} وحدة من أصل ${d.pulled} صف`,
    });
    const { data: s } = await supabase
      .from("app_settings")
      .select("buildings_sheet_last_sync_at, buildings_sheet_last_direction")
      .eq("id", 1).maybeSingle();
    if (s) { setLastSync(s.buildings_sheet_last_sync_at); setLastDir(s.buildings_sheet_last_direction); }
  };

  const toggle = (b: number) =>
    setSelected(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b].sort((a,c)=>a-c));

  const sheetUrl = originalId ? `https://docs.google.com/spreadsheets/d/${originalId}/edit` : "";

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">مزامنة المباني مع Google Sheets</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إعداد الشييت</CardTitle>
          <CardDescription>
            الصق رابط الـ Google Sheet أو الـ ID. لازم يكون الشييت مشارَك مع حساب Google المربوط.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>رابط الشييت أو الـ ID</Label>
            <div className="flex gap-2">
              <Input
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                dir="ltr"
              />
              <Button onClick={saveId} disabled={saving || sheetId === originalId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="mr-2">حفظ</span>
              </Button>
            </div>
            {sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> فتح الشييت
              </a>
            )}
          </div>

          {lastSync && (
            <p className="text-sm text-muted-foreground">
              آخر مزامنة: {new Date(lastSync).toLocaleString("ar-SA")} ({lastDir === "push" ? "رفع للشييت" : "سحب من الشييت"})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اختر المباني</CardTitle>
          <CardDescription>كل مبنى بيتعمله تبويب باسم "مبنى N" في الشييت.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {BUILDINGS.map(b => (
              <label key={b} className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-muted">
                <Checkbox checked={selected.includes(b)} onCheckedChange={() => toggle(b)} />
                <span className="text-sm font-medium">مبنى {b}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setSelected(BUILDINGS)}>الكل</Button>
            <Button variant="outline" size="sm" onClick={() => setSelected([])}>إلغاء الكل</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المزامنة</CardTitle>
          <CardDescription>
            <strong>رفع للشييت:</strong> بيكتب بيانات الوحدات والمستأجرين من السيستم على الشييت (بيمسح اللي فيه ويستبدله).<br />
            <strong>سحب من الشييت:</strong> بيقرأ الشييت ويحدّث بيانات الوحدات في السيستم (النوع، المساحة، النشاط، السعر، الحالة).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => run("push")} disabled={busy !== null} size="lg">
            {busy === "push" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            <span className="mr-2">رفع للشييت</span>
          </Button>
          <Button onClick={() => run("pull")} disabled={busy !== null} size="lg" variant="secondary">
            {busy === "pull" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            <span className="mr-2">سحب من الشييت</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أعمدة الشييت</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {["رقم الوحدة","النوع","المساحة","النشاط","السعر","الحالة","اسم المستأجر","الجوال","الاسم التجاري","السجل التجاري","تاريخ البداية","تاريخ النهاية","ملاحظات"].map((h,i)=>(
              <li key={h} className="px-3 py-1.5 bg-muted rounded">{String.fromCharCode(65+i)} — {h}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
