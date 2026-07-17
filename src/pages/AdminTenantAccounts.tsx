import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  Lock,
  Plus,
  Minus,
  Search,
  KeyRound,
  Link2,
  Trash2,
  Building2,
  Receipt,
  Copy,
  X,
  Loader2,
  Pencil,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
  Paperclip,
} from "lucide-react";
import { exportRowsToExcel } from "@/lib/exportData";
import { TenantFilesDialog } from "@/components/TenantFilesDialog";

const TONE_CLS: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  rose: "bg-rose-500/10 text-rose-600",
};

function StatCard({
  title, value, hint, Icon, tone = "primary",
}: {
  title: string; value: string; hint?: string; Icon: any;
  tone?: "primary" | "emerald" | "amber" | "sky" | "violet" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">{title}</div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_CLS[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold leading-tight sm:text-xl">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{hint}</div>}
    </div>
  );
}

type FilterKey = "all" | "with_units" | "no_units" | "unpaid" | "fully_paid" | "has_login" | "no_login";

type TenantRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  activity_type: string | null;
  notes: string | null;
  total_price: number;
  paid_amount: number;
  created_at: string;
  units_count: number;
  unpaid_invoices: number;
  unpaid_total: number;
  has_login: boolean;
  cr_number: string | null;
};

type Unit = {
  id: string;
  building_number: number;
  unit_number: number;
  unit_type: string | null;
  status: string;
  area: number;
  price: number;
};

type LinkedUnit = { id: string; unit_id: string; unit?: Unit };
type Invoice = {
  id: string;
  unit_id: string | null;
  amount: number;
  paid_amount: number;
  paid: boolean;
  due_date: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
};

const callTenantAdmin = async (body: any) => {
  const { data, error } = await supabase.functions.invoke("tenant-admin", { body });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
};

export default function AdminTenantAccounts() {
  const nav = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);
  const [filterKey, setFilterKey] = useState<FilterKey>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filesFor, setFilesFor] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc("admin_list_tenant_accounts");
    if (error) toast.error(error.message);
    else setRows((data as TenantRow[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && (isAdmin || isManager)) load();
  }, [loading, isAdmin, isManager]);

  const matchesFilter = (r: TenantRow, key: FilterKey) => {
    switch (key) {
      case "all": return true;
      case "with_units": return (r.units_count ?? 0) > 0;
      case "no_units": return (r.units_count ?? 0) === 0;
      case "unpaid": return Number(r.unpaid_invoices ?? 0) > 0 || Number(r.paid_amount ?? 0) < Number(r.total_price ?? 0);
      case "fully_paid": return Number(r.total_price ?? 0) > 0 && Number(r.paid_amount ?? 0) >= Number(r.total_price ?? 0);
      case "has_login": return !!r.has_login;
      case "no_login": return !r.has_login;
    }
  };

  const stats = useMemo(() => {
    const scoped = rows.filter((r) => matchesFilter(r, filterKey));
    const totalContracts = scoped.reduce((s, r) => s + Number(r.total_price || 0), 0);
    const totalPaid = scoped.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const remaining = Math.max(0, totalContracts - totalPaid);
    const collectionRate = totalContracts > 0 ? Math.round((totalPaid / totalContracts) * 100) : 0;
    const unpaidCount = scoped.filter((r) => Number(r.unpaid_invoices || 0) > 0).length;
    const unpaidTotal = scoped.reduce((s, r) => s + Number(r.unpaid_total || 0), 0);
    const fullyPaid = scoped.filter((r) => Number(r.total_price || 0) > 0 && Number(r.paid_amount || 0) >= Number(r.total_price || 0)).length;
    const withUnits = scoped.filter((r) => (r.units_count ?? 0) > 0).length;
    const withLogin = scoped.filter((r) => r.has_login).length;
    const totalUnits = scoped.reduce((s, r) => s + Number(r.units_count || 0), 0);
    return {
      count: scoped.length,
      totalContracts, totalPaid, remaining, collectionRate,
      unpaidCount, unpaidTotal, fullyPaid, withUnits, withLogin, totalUnits,
    };
  }, [rows, filterKey]);

  if (!loading && !user) {
    nav("/auth");
    return null;
  }
  if (!loading && !isAdmin && !isManager) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
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

  const filtered = rows.filter((r) => {
    if (!matchesFilter(r, filterKey)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.full_name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      (r.business_name ?? "").toLowerCase().includes(q)
    );
  });

  const filterChips: { id: FilterKey; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "with_units", label: "بوحدات" },
    { id: "no_units", label: "بدون وحدات" },
    { id: "unpaid", label: "متأخرات" },
    { id: "fully_paid", label: "مسددة بالكامل" },
    { id: "has_login", label: "لديهم دخول" },
    { id: "no_login", label: "بدون دخول" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-card">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold sm:text-2xl">حسابات المستأجرين</h1>
              <p className="text-xs text-muted-foreground">{rows.length} حساب</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            إنشاء حساب
          </button>
        </div>

        {/* Stats */}
        {!fetching && rows.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              title={filterKey === "all" ? "إجمالي الحسابات" : `الحسابات (${filterChips.find((f) => f.id === filterKey)?.label})`}
              value={fmtNum(stats.count)}
              hint={`${stats.totalUnits} وحدة مرتبطة`}
              Icon={Users}
              tone="primary"
            />
            <StatCard
              title="قيمة العقود"
              value={`${fmtNum(stats.totalContracts)} ر.س`}
              hint="إجمالي السعر السنوي"
              Icon={Receipt}
              tone="violet"
            />
            <StatCard
              title="المحصل"
              value={`${fmtNum(stats.totalPaid)} ر.س`}
              hint={`نسبة التحصيل ${stats.collectionRate}%`}
              Icon={Wallet}
              tone="emerald"
            />
            <StatCard
              title="المتبقي"
              value={`${fmtNum(stats.remaining)} ر.س`}
              hint={stats.remaining > 0 ? "غير محصّل" : "تم التحصيل بالكامل"}
              Icon={TrendingUp}
              tone="amber"
            />
            <StatCard
              title="فواتير متأخرة"
              value={fmtNum(stats.unpaidCount)}
              hint={`${fmtNum(stats.unpaidTotal)} ر.س`}
              Icon={AlertTriangle}
              tone="rose"
            />
            <StatCard
              title="مسددة بالكامل"
              value={fmtNum(stats.fullyPaid)}
              hint="عقود مغلقة ماليًا"
              Icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              title="بوحدات مرتبطة"
              value={fmtNum(stats.withUnits)}
              hint={`${fmtNum(stats.totalUnits)} وحدة`}
              Icon={Building2}
              tone="sky"
            />
            <StatCard
              title="لديهم دخول"
              value={fmtNum(stats.withLogin)}
              hint="حسابات مفعّلة"
              Icon={KeyRound}
              tone="primary"
            />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، الإيميل، الجوال، النشاط..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            {filterChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterKey(c.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterKey === c.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const data = filtered.map((r) => ({
                "الاسم": r.full_name,
                "النشاط": r.activity_type || r.business_name || "",
                "الاسم التجاري": r.business_name || "",
                "الرقم الوطني الموحد": r.cr_number || "",
                "الجوال": r.phone || "",
                "الإيميل": r.email || "",
                "وحدات": r.units_count ?? 0,
                "السعر السنوي (ر.س)": Number(r.total_price || 0),
                "المدفوع (ر.س)": Number(r.paid_amount || 0),
                "المتبقي (ر.س)": Math.max(0, Number(r.total_price || 0) - Number(r.paid_amount || 0)),
                "فواتير غير مدفوعة": r.unpaid_invoices ?? 0,
                "إجمالي غير المدفوع (ر.س)": Number(r.unpaid_total || 0),
                "دخول مفعل": r.has_login ? "نعم" : "لا",
              }));
              if (!data.length) { toast.error("لا يوجد بيانات للتصدير"); return; }
              exportRowsToExcel(data, "tenant-accounts", "المستأجرون");
              toast.success("تم التصدير");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm"
          >
            <Download className="h-4 w-4" /> تصدير
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {fetching ? (
            <div className="p-12 text-center text-muted-foreground">جارِ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد حسابات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-border bg-secondary/50 text-xs">
                  <tr>
                    <th className="p-3 text-right">الاسم</th>
                    <th className="p-3 text-right">النشاط</th>
                    <th className="p-3 text-right">الرقم الوطني الموحد</th>
                    <th className="p-3 text-right">الجوال</th>
                    <th className="p-3 text-right">وحدات</th>
                    <th className="p-3 text-right">السعر السنوي</th>
                    <th className="p-3 text-right">المدفوع</th>
                    <th className="p-3 text-right">فواتير</th>
                    <th className="p-3 text-right">دخول</th>
                    <th className="p-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{r.full_name}</td>
                      <td className="p-3 text-muted-foreground">{r.activity_type || r.business_name || "—"}</td>
                      <td className="p-3 text-muted-foreground" dir="ltr">{r.cr_number || "—"}</td>
                      <td className="p-3 text-muted-foreground" dir="ltr">{r.phone || "—"}</td>
                      <td className="p-3 font-bold">{r.units_count}</td>
                      <td className="p-3 font-bold text-primary">{Number(r.total_price).toLocaleString()} ر.س</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {Number(r.paid_amount) > 0 ? (
                            <span className="font-bold text-emerald-600">{Number(r.paid_amount).toLocaleString()} ر.س</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          <button
                            onClick={async () => {
                              const remaining = Math.max(0, Number(r.total_price || 0) - Number(r.paid_amount || 0));
                              const input = window.prompt(
                                `أدخل مبلغ الدفعة من ${r.full_name}\nالمتبقي: ${remaining.toLocaleString()} ر.س`,
                                "",
                              );
                              if (input === null) return;
                              const amount = Number(input);
                              if (!Number.isFinite(amount) || amount <= 0) return toast.error("أدخل مبلغًا صحيحًا");
                              const method = window.prompt("طريقة الدفع: cash / transfer / card / check", "cash") || "cash";
                              const notes = window.prompt("ملاحظات (اختياري)", "") || null;
                              const { data: invId, error } = await supabase.rpc("record_payment" as any, {
                                _tenant_account_id: r.id, _amount: amount, _method: method, _notes: notes,
                              });
                              if (error) return toast.error(error.message);
                              toast.success("تم تسجيل الدفعة وإصدار الفاتورة");
                              try { await supabase.functions.invoke("send-invoice-telegram", { body: { invoice_id: invId } }); } catch {}
                              load();
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                          >
                            <Plus className="h-3 w-3" />
                            إضافة دفعة
                          </button>
                          <button
                            onClick={async () => {
                              const paid = Number(r.paid_amount || 0);
                              if (paid <= 0) return toast.error("لا يوجد مدفوع لخصمه");
                              const input = window.prompt(
                                `أدخل المبلغ المراد خصمه من ${r.full_name}\nالمدفوع حاليًا: ${paid.toLocaleString()} ر.س`,
                                "",
                              );
                              if (input === null) return;
                              const amount = Number(input);
                              if (!Number.isFinite(amount) || amount <= 0) return toast.error("أدخل مبلغًا صحيحًا");
                              const notes = window.prompt("سبب الخصم (اختياري)", "تصحيح مبلغ زائد") || null;
                              if (!window.confirm(`تأكيد خصم ${amount.toLocaleString()} ر.س من المدفوع؟`)) return;
                              const { error } = await supabase.rpc("adjust_payment" as any, {
                                _tenant_account_id: r.id, _amount: -Math.abs(amount), _notes: notes,
                              });
                              if (error) return toast.error(error.message);
                              toast.success("تم خصم المبلغ");
                              load();
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
                          >
                            <Minus className="h-3 w-3" />
                            خصم
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        {r.unpaid_invoices > 0 ? (
                          <span className="text-destructive">
                            {r.unpaid_invoices} ({Number(r.unpaid_total).toLocaleString()})
                          </span>
                        ) : (
                          <span className="text-emerald-600">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.has_login ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">مفعل</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">بدون</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setFilesFor({ id: r.id, name: r.full_name })}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                            title="الملفات"
                          >
                            <Paperclip className="h-3 w-3" />
                            ملفات
                          </button>
                          <button
                            onClick={() => setDetailId(r.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                          >
                            <Pencil className="h-3 w-3" />
                            إدارة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {detailId && (
        <DetailModal
          tenantId={detailId}
          onClose={() => {
            setDetailId(null);
            load();
          }}
        />
      )}

      {filesFor && (
        <TenantFilesDialog
          open={!!filesFor}
          tenantAccountId={filesFor.id}
          tenantName={filesFor.name}
          onClose={() => setFilesFor(null)}
        />
      )}

      <Footer />
    </div>
  );
}

// ============ Create Modal ============
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [business_name, setBusiness] = useState("");
  const [cr_number, setCrNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("units")
      .select("id, building_number, unit_number, unit_type, status, area, price")
      .order("building_number")
      .order("unit_number")
      .then(({ data }) => setUnits((data as any) ?? []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!full_name || !email || !password) return toast.error("الاسم والإيميل وكلمة السر مطلوبة");
    setBusy(true);
    try {
      await callTenantAdmin({
        action: "create",
        full_name,
        email,
        phone,
        password,
        business_name,
        cr_number,
        notes,
        unit_ids: Array.from(selected),
      });
      toast.success("تم إنشاء الحساب");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "فشل الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="إنشاء حساب مستأجر" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="الاسم الكامل *">
          <input value={full_name} onChange={(e) => setFullName(e.target.value)} className={inp} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الإيميل *">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inp} required dir="ltr" />
          </Field>
          <Field label="الجوال">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} dir="ltr" placeholder="+20..." />
          </Field>
        </div>
        <Field label="كلمة المرور *">
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className={inp} required minLength={6} />
        </Field>
        <Field label="اسم النشاط">
          <input value={business_name} onChange={(e) => setBusiness(e.target.value)} className={inp} />
        </Field>
        <Field label="الرقم الوطني الموحد">
          <input value={cr_number} onChange={(e) => setCrNumber(e.target.value)} className={inp} dir="ltr" />
        </Field>
        <Field label="ملاحظات">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} rows={2} />
        </Field>

        <Field label="الوحدات المرتبطة">
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-2">
            {units.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">لا توجد وحدات</div>
            ) : (
              units.map((u) => {
                const checked = selected.has(u.id);
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-xs hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const s = new Set(selected);
                        e.target.checked ? s.add(u.id) : s.delete(u.id);
                        setSelected(s);
                      }}
                    />
                    <span className="font-medium">مبنى {u.building_number} - وحدة {u.unit_number}</span>
                    <span className="text-muted-foreground">({u.unit_type || "—"} - {u.status})</span>
                  </label>
                );
              })
            )}
          </div>
        </Field>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          إنشاء
        </button>
      </form>
    </Modal>
  );
}

// ============ Detail Modal ============
function DetailModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"profile" | "units" | "invoices" | "auth">("profile");
  const [account, setAccount] = useState<any>(null);
  const [linked, setLinked] = useState<LinkedUnit[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  const load = async () => {
    const { data: ta } = await supabase.from("tenant_accounts").select("*").eq("id", tenantId).single();
    setAccount(ta);
    const { data: lu } = await supabase
      .from("tenant_account_units")
      .select("id, unit_id")
      .eq("tenant_account_id", tenantId);
    const linkRows = (lu as any[]) ?? [];
    if (linkRows.length > 0) {
      const { data: us } = await supabase
        .from("units")
        .select("id, building_number, unit_number, unit_type, status, area, price")
        .in("id", linkRows.map((l) => l.unit_id));
      setLinked(linkRows.map((l) => ({ ...l, unit: (us as any)?.find((u: any) => u.id === l.unit_id) })));
    } else setLinked([]);

    const { data: au } = await supabase
      .from("units")
      .select("id, building_number, unit_number, unit_type, status, area, price")
      .order("building_number")
      .order("unit_number");
    setAllUnits((au as any) ?? []);

    const { data: inv } = await supabase
      .from("invoices")
      .select("*")
      .eq("tenant_account_id", tenantId)
      .order("created_at", { ascending: false });
    setInvoices((inv as any) ?? []);
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  if (!account) return <Modal title="جارِ التحميل" onClose={onClose}><div className="p-6 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></Modal>;

  return (
    <Modal title={account.full_name} onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-border">
        {[
          { id: "profile", label: "البيانات" },
          { id: "units", label: "الوحدات" },
          { id: "invoices", label: "الفواتير" },
          { id: "auth", label: "الحساب والدخول" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium ${tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab account={account} onSaved={load} />}
      {tab === "units" && <UnitsTab tenantId={tenantId} linked={linked} allUnits={allUnits} onChanged={load} />}
      {tab === "invoices" && <InvoicesTab tenantId={tenantId} linked={linked} invoices={invoices} onChanged={load} />}
      {tab === "auth" && (
        <AuthTab tenantId={tenantId} magicLink={magicLink} setMagicLink={setMagicLink} onDeleted={onClose} />
      )}
    </Modal>
  );
}

function ProfileTab({ account, onSaved }: { account: any; onSaved: () => void }) {
  const [full_name, setFullName] = useState(account.full_name || "");
  const [email, setEmail] = useState(account.email || "");
  const [phone, setPhone] = useState(account.phone || "");
  const [business_name, setBusiness] = useState(account.business_name || "");
  const [cr_number, setCrNumber] = useState(account.cr_number || "");
  const [notes, setNotes] = useState(account.notes || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await callTenantAdmin({
        action: "update_profile",
        tenant_account_id: account.id,
        full_name,
        email,
        phone,
        business_name,
        cr_number,
        notes,
      });
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="الاسم"><input value={full_name} onChange={(e) => setFullName(e.target.value)} className={inp} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الإيميل"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inp} dir="ltr" /></Field>
        <Field label="الجوال"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} dir="ltr" /></Field>
      </div>
      <Field label="النشاط"><input value={business_name} onChange={(e) => setBusiness(e.target.value)} className={inp} /></Field>
      <Field label="الرقم الوطني الموحد"><input value={cr_number} onChange={(e) => setCrNumber(e.target.value)} className={inp} dir="ltr" /></Field>
      <Field label="ملاحظات"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} rows={3} /></Field>
      <button onClick={save} disabled={busy} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "..." : "حفظ"}
      </button>
    </div>
  );
}

function UnitsTab({ tenantId, linked, allUnits, onChanged }: { tenantId: string; linked: LinkedUnit[]; allUnits: Unit[]; onChanged: () => void }) {
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const linkedIds = new Set(linked.map((l) => l.unit_id));
  const available = allUnits.filter((u) => !linkedIds.has(u.id));

  const add = async () => {
    if (adding.size === 0) return;
    const { error } = await supabase.rpc("admin_link_tenant_units", {
      _tenant_account_id: tenantId,
      _unit_ids: Array.from(adding),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم الربط");
      setAdding(new Set());
      onChanged();
    }
  };
  const remove = async (unitId: string) => {
    const { error } = await supabase.rpc("admin_unlink_tenant_unit", {
      _tenant_account_id: tenantId,
      _unit_id: unitId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم الإلغاء");
      onChanged();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-bold">الوحدات المرتبطة ({linked.length})</h3>
        <div className="space-y-2">
          {linked.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-center text-xs text-muted-foreground">لا توجد وحدات</div>
          ) : (
            linked.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">مبنى {l.unit?.building_number} - وحدة {l.unit?.unit_number}</span>
                  <span className="text-xs text-muted-foreground">({l.unit?.unit_type || "—"})</span>
                </div>
                <button onClick={() => remove(l.unit_id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">إضافة وحدات</h3>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-2">
          {available.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">لا توجد وحدات متاحة للإضافة</div>
          ) : (
            available.map((u) => {
              const checked = adding.has(u.id);
              return (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-xs hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const s = new Set(adding);
                      e.target.checked ? s.add(u.id) : s.delete(u.id);
                      setAdding(s);
                    }}
                  />
                  <span className="font-medium">مبنى {u.building_number} - وحدة {u.unit_number}</span>
                  <span className="text-muted-foreground">({u.status})</span>
                </label>
              );
            })
          )}
        </div>
        {adding.size > 0 && (
          <button onClick={add} className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            ربط {adding.size} وحدة
          </button>
        )}
      </div>
    </div>
  );
}

function InvoicesTab({ tenantId, linked, invoices, onChanged }: { tenantId: string; linked: LinkedUnit[]; invoices: Invoice[]; onChanged: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-800">
        الفواتير هنا للعرض فقط. لإصدار فاتورة جديدة، افتح إعدادات الوحدة المؤجرة من صفحة الوحدات وأنشئها من هناك — سيتم ربطها تلقائياً بالمستأجر واحتسابها عليه.
      </div>

      <div className="space-y-2">
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">لا توجد فواتير</div>
        ) : (
          invoices.map((inv) => {
            const linkedUnit = linked.find((l) => l.unit_id === inv.unit_id)?.unit;
            return (
              <div key={inv.id} className={`flex items-center justify-between rounded-xl border p-3 ${inv.paid ? "border-emerald-200 bg-emerald-50/50" : "border-border"}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="h-4 w-4 text-primary" />
                    <span className="font-bold">{Number(inv.amount).toLocaleString()} ر.س</span>
                    {linkedUnit && <span className="text-xs text-muted-foreground">— مبنى {linkedUnit.building_number} وحدة {linkedUnit.unit_number}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${inv.paid ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                      {inv.paid ? "مدفوعة" : "غير مدفوعة"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {inv.due_date && <>استحقاق: {inv.due_date} · </>}
                    {inv.period_start && <>الفترة: {inv.period_start} → {inv.period_end} · </>}
                    {inv.notes}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


function AuthTab({ tenantId, magicLink, setMagicLink, onDeleted }: { tenantId: string; magicLink: string | null; setMagicLink: (s: string | null) => void; onDeleted: () => void }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState(24);

  const setPassword = async () => {
    if (pwd.length < 6) return toast.error("6 أحرف على الأقل");
    setBusy(true);
    try {
      await callTenantAdmin({ action: "set_password", tenant_account_id: tenantId, password: pwd });
      toast.success("تم تغيير كلمة السر");
      setPwd("");
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  const genLink = async () => {
    setBusy(true);
    try {
      const r = await callTenantAdmin({ action: "magic_link", tenant_account_id: tenantId, hours });
      setMagicLink((r as any).url);
      toast.success("تم توليد الرابط");
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("حذف الحساب نهائياً؟ لن يتمكن المستأجر من الدخول بعد ذلك.")) return;
    setBusy(true);
    try {
      await callTenantAdmin({ action: "delete", tenant_account_id: tenantId });
      toast.success("تم الحذف");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><KeyRound className="h-4 w-4" /> تغيير كلمة المرور</h3>
        <div className="flex gap-2">
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} className={inp} placeholder="كلمة سر جديدة (6 أحرف+)" />
          <button onClick={setPassword} disabled={busy} className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">حفظ</button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Link2 className="h-4 w-4" /> رابط دخول لمرة واحدة</h3>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">صلاحية (ساعات):</label>
          <input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          <button onClick={genLink} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">توليد رابط</button>
        </div>
        {magicLink && (
          <div className="space-y-2">
            <div className="break-all rounded-lg bg-secondary p-2 text-xs" dir="ltr">{magicLink}</div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(magicLink);
                toast.success("تم النسخ");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              <Copy className="h-3 w-3" /> نسخ الرابط
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> حذف الحساب</h3>
        <button onClick={del} disabled={busy} className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50">حذف نهائي</button>
      </div>
    </div>
  );
}

// ============ shared ui ============
const inp = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir="rtl"
        className={`max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
