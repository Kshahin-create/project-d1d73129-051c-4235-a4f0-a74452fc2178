import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Lock, MessageCircle, Plus, Search, Trash2, Download, Phone, Building2, Tag, Activity } from "lucide-react";
import { exportRowsToExcel, exportRowsToCSV } from "@/lib/exportData";

interface InterestedRow {
  id: string;
  full_name: string;
  phone: string;
  requested_activity: string | null;
  business_name: string | null;
  requested_building: string | null;
  requested_unit: string | null;
  customer_source: string | null;
  notes: string | null;
  source: string;
  status: string;
  created_at: string;
}

const SOURCE_OPTIONS = ["تيليجرام", "واتساب", "إعلان", "توصية", "زيارة ميدانية", "موقع إلكتروني", "أخرى"];
const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  converted: "تم التحويل",
  closed: "مغلق",
};
const STATUS_CLS: Record<string, string> = {
  new: "bg-sky-500/10 text-sky-600",
  contacted: "bg-amber-500/10 text-amber-600",
  converted: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

const empty = {
  full_name: "",
  phone: "",
  requested_activity: "",
  business_name: "",
  requested_building: "",
  requested_unit: "",
  customer_source: "",
  customer_source_other: "",
  notes: "",
};

const AdminInterested = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const canAccess = isAdmin || isManager;
  const [rows, setRows] = useState<InterestedRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("interested_customers" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setRows((data as any) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && canAccess) {
      load();
      // Realtime
      const ch = supabase
        .channel("interested-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "interested_customers" }, () => load())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [loading, canAccess]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.phone, r.business_name, r.requested_activity, r.requested_building, r.requested_unit, r.customer_source, r.notes]
        .filter(Boolean)
        .some((v) => v!.toString().toLowerCase().includes(q))
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      new: by("new"),
      contacted: by("contacted"),
      converted: by("converted"),
      fromTelegram: rows.filter((r) => r.source === "telegram").length,
    };
  }, [rows]);

  const saveForm = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("الاسم والجوال إجباريان");
      return;
    }
    setSaving(true);
    const customerSource =
      form.customer_source === "أخرى"
        ? form.customer_source_other.trim() || "أخرى"
        : form.customer_source || null;
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      requested_activity: form.requested_activity.trim() || null,
      business_name: form.business_name.trim() || null,
      requested_building: form.requested_building.trim() || null,
      requested_unit: form.requested_unit.trim() || null,
      customer_source: customerSource,
      notes: form.notes.trim() || null,
      source: "manual",
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("interested_customers" as any)
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
      return;
    }
    toast.success("تم حفظ بيانات المهتم");
    // Notify telegram (fire-and-forget)
    supabase.functions.invoke("interested-notify", { body: { interested: data } }).catch(() => {});
    setForm({ ...empty });
    setShowForm(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("interested_customers" as any)
      .update({ status })
      .eq("id", id);
    if (error) toast.error("فشل التحديث: " + error.message);
    else toast.success("تم تحديث الحالة");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف بيانات المهتم؟")) return;
    const { error } = await supabase.from("interested_customers" as any).delete().eq("id", id);
    if (error) toast.error("فشل الحذف: " + error.message);
    else toast.success("تم الحذف");
  };

  const exportRows = (fmt: "xlsx" | "csv") => {
    const data = filtered.map((r) => ({
      "اسم العميل": r.full_name,
      "رقم الجوال": r.phone,
      "النشاط المطلوب": r.requested_activity ?? "",
      "الاسم التجاري": r.business_name ?? "",
      "المبنى المطلوب": r.requested_building ?? "",
      "الوحدة المطلوبة": r.requested_unit ?? "",
      "مصدر العميل": r.customer_source ?? "",
      "الملاحظات": r.notes ?? "",
      "المصدر": r.source === "telegram" ? "تيليجرام" : r.source === "web" ? "ويب" : "يدوي",
      "الحالة": STATUS_LABEL[r.status] ?? r.status,
      "تاريخ التسجيل": new Date(r.created_at).toLocaleString("ar-EG-u-nu-latn"),
    }));
    if (fmt === "xlsx") exportRowsToExcel(data, "interested", "المهتمون");
    else exportRowsToCSV(data, "interested");
  };

  if (!loading && !user) { navigate("/auth"); return null; }
  if (!loading && user && !canAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">المهتمون</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{rows.length} مهتم • {stats.fromTelegram} من تيليجرام</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm">
              <ArrowRight className="h-4 w-4" /> رجوع
            </Link>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:text-sm"
            >
              <Plus className="h-4 w-4" /> {showForm ? "إغلاق" : "إضافة مهتم"}
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { l: "إجمالي", v: stats.total, c: "bg-primary/10 text-primary" },
            { l: "جديد", v: stats.new, c: "bg-sky-500/10 text-sky-600" },
            { l: "تم التواصل", v: stats.contacted, c: "bg-amber-500/10 text-amber-600" },
            { l: "تم التحويل", v: stats.converted, c: "bg-emerald-500/10 text-emerald-600" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
              <div className={`mb-1.5 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold ${s.c}`}>{s.l}</div>
              <div className="font-display text-xl font-bold">{s.v}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-display text-lg font-bold">إضافة مهتم جديد</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="اسم العميل *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="رقم الجوال *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="النشاط المطلوب" value={form.requested_activity} onChange={(e) => setForm({ ...form, requested_activity: e.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="الاسم التجاري" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="المبنى المطلوب" value={form.requested_building} onChange={(e) => setForm({ ...form, requested_building: e.target.value })} />
              <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="الوحدة المطلوبة" value={form.requested_unit} onChange={(e) => setForm({ ...form, requested_unit: e.target.value })} />
              <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={form.customer_source} onChange={(e) => setForm({ ...form, customer_source: e.target.value })}>
                <option value="">— مصدر العميل —</option>
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {form.customer_source === "أخرى" && (
                <input className="rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="حدد المصدر" value={form.customer_source_other} onChange={(e) => setForm({ ...form, customer_source_other: e.target.value })} />
              )}
              <textarea className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2" rows={2} placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setForm({ ...empty }); setShowForm(false); }} className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-secondary">إلغاء</button>
              <button onClick={saveForm} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث..." className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <button onClick={() => exportRows("xlsx")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm">
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => exportRows("csv")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>

        {fetching ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا يوجد مهتمون</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-right">العميل</th>
                    <th className="px-3 py-2 text-right">الجوال</th>
                    <th className="px-3 py-2 text-right">النشاط</th>
                    <th className="px-3 py-2 text-right">الاسم التجاري</th>
                    <th className="px-3 py-2 text-right">المبنى/الوحدة</th>
                    <th className="px-3 py-2 text-right">المصدر</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{r.full_name}</td>
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">{r.phone}</td>
                      <td className="px-3 py-2 text-xs">{r.requested_activity ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.business_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.requested_building ? `مبنى ${r.requested_building}` : "—"}
                        {r.requested_unit ? ` / وحدة ${r.requested_unit}` : ""}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{r.customer_source ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.source === "telegram" ? "📱 تيليجرام" : r.source === "web" ? "🌐 ويب" : "✍️ يدوي"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${STATUS_CLS[r.status] ?? ""}`}>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => remove(r.id)} className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20" title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminInterested;
