import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Lock, Search, ArrowRight, Phone, Building2, Pencil, Trash2 } from "lucide-react";

interface TenantRow {
  id: string;
  unit_id: string;
  tenant_name: string;
  business_name: string | null;
  activity_type: string | null;
  phone: string | null;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  units?: {
    unit_number: number;
    building_number: number;
    status: string;
    price: number;
  } | null;
}

const STATUS_AR: Record<string, { label: string; cls: string }> = {
  rented: { label: "مؤجر", cls: "bg-emerald-500/10 text-emerald-600" },
  reserved: { label: "محجوز", cls: "bg-amber-500/10 text-amber-600" },
  available: { label: "متاح", cls: "bg-slate-500/10 text-slate-600" },
};

const AdminTenants = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [form, setForm] = useState({ tenant_name: "", business_name: "", activity_type: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("*, units(unit_number, building_number, status, price)")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setRows((data as any) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.tenant_name, r.business_name, r.phone, r.activity_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)) ||
      String(r.units?.unit_number ?? "").includes(q)
    );
  }, [rows, search]);

  const openEdit = (t: TenantRow) => {
    setEditing(t);
    setForm({
      tenant_name: t.tenant_name ?? "",
      business_name: t.business_name ?? "",
      activity_type: t.activity_type ?? "",
      phone: t.phone ?? "",
      notes: t.notes ?? "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.tenant_name.trim()) {
      toast.error("اسم المستأجر مطلوب");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        tenant_name: form.tenant_name.trim(),
        business_name: form.business_name.trim() || null,
        activity_type: form.activity_type.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
    } else {
      toast.success("تم الحفظ");
      setEditing(null);
      load();
    }
  };

  const handleDelete = async (t: TenantRow) => {
    if (!confirm(`حذف بيانات المستأجر «${t.tenant_name}»؟ (الوحدة لن تتأثر)`)) return;
    const { error } = await supabase.from("tenants").delete().eq("id", t.id);
    if (error) toast.error("فشل الحذف: " + error.message);
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }
  if (!loading && user && !isAdmin) {
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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">المستأجرون والحجوزات</h1>
              <p className="text-sm text-muted-foreground">{rows.length} سجل</p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            <ArrowRight className="h-4 w-4" /> رجوع
          </Link>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الهاتف، النشاط، رقم الوحدة..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {fetching ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">جارِ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد سجلات</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((t) => {
              const st = STATUS_AR[t.units?.status ?? "available"];
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg font-bold">{t.tenant_name}</div>
                      {t.business_name && (
                        <div className="text-sm text-muted-foreground">{t.business_name}</div>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {t.units && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        مبنى {t.units.building_number} - وحدة {t.units.unit_number}
                      </div>
                    )}
                    {t.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span dir="ltr">{t.phone}</span>
                      </div>
                    )}
                    {t.activity_type && (
                      <div className="text-muted-foreground">النشاط: {t.activity_type}</div>
                    )}
                    {t.start_date && (
                      <div className="text-muted-foreground">
                        البداية: {new Date(t.start_date).toLocaleDateString("ar-EG")}
                      </div>
                    )}
                  </div>
                  {t.notes && (
                    <p className="mt-2 rounded-lg bg-secondary p-2 text-xs text-muted-foreground">{t.notes}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <Pencil className="h-3 w-3" /> تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-destructive/10 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3" /> حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
          onClick={() => setEditing(null)}
          dir="rtl"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-display text-lg font-bold">تعديل بيانات المستأجر</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">اسم المستأجر *</label>
                <input
                  value={form.tenant_name}
                  onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">اسم النشاط</label>
                <input
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">نوع النشاط</label>
                <input
                  value={form.activity_type}
                  onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">رقم الجوال</label>
                <input
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">ملاحظات</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground hover:shadow-elevated disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminTenants;
