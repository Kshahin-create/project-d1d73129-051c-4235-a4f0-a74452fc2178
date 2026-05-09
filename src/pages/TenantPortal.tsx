import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Receipt, Lock, User, Loader2 } from "lucide-react";

type Unit = {
  id: string;
  building_number: number;
  unit_number: number;
  unit_type: string | null;
  area: number;
  price: number;
  activity: string | null;
  status: string;
};
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
type Account = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
};

export default function TenantPortal() {
  const nav = useNavigate();
  const { user, loading, isTenant, isAdmin, isManager } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<"units" | "invoices" | "profile">("units");
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav("/auth");
      return;
    }
    (async () => {
      const { data: ta } = await supabase.from("tenant_accounts").select("*").eq("user_id", user.id).maybeSingle();
      if (ta) {
        setAccount(ta as any);
        const { data: tau } = await supabase.from("tenant_account_units").select("unit_id").eq("tenant_account_id", ta.id);
        const ids = ((tau as any[]) ?? []).map((x) => x.unit_id);
        if (ids.length > 0) {
          const { data: us } = await supabase.from("units").select("*").in("id", ids);
          setUnits((us as any) ?? []);
        }
        const { data: inv } = await supabase
          .from("invoices")
          .select("*")
          .eq("tenant_account_id", ta.id)
          .order("created_at", { ascending: false });
        setInvoices((inv as any) ?? []);
      }
      setFetching(false);
    })();
  }, [loading, user, nav]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container-tight py-16 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!account && !isTenant && !isAdmin && !isManager) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا يوجد حساب مستأجر مرتبط</h2>
            <p className="mt-2 text-sm text-muted-foreground">تواصل مع الإدارة لإنشاء حسابك.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const filtered = invoices.filter((i) =>
    filter === "all" ? true : filter === "paid" ? i.paid : !i.paid
  );
  const unpaidTotal = invoices.filter((i) => !i.paid).reduce((s, i) => s + Number(i.amount) - Number(i.paid_amount), 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 rounded-2xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl font-bold">أهلاً {account?.full_name}</h1>
          {account?.business_name && <p className="text-sm text-muted-foreground">{account.business_name}</p>}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="الوحدات" value={units.length} />
            <Stat label="فواتير" value={invoices.length} />
            <Stat label="غير مدفوع" value={`${unpaidTotal.toLocaleString()} ر.س`} accent="destructive" />
          </div>
        </div>

        <div className="mb-4 flex gap-1 border-b border-border">
          {[
            { id: "units", label: "وحداتي", Icon: Building2 },
            { id: "invoices", label: "الفواتير", Icon: Receipt },
            { id: "profile", label: "بياناتي", Icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "units" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {units.length === 0 ? (
              <div className="col-span-full rounded-xl border border-border p-8 text-center text-muted-foreground">لا توجد وحدات</div>
            ) : (
              units.map((u) => (
                <div key={u.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-bold">مبنى {u.building_number} - وحدة {u.unit_number}</h3>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <Row label="النوع" value={u.unit_type || "—"} />
                    <Row label="النشاط" value={u.activity || "—"} />
                    <Row label="المساحة" value={`${u.area} م²`} />
                    <Row label="السعر السنوي" value={`${Number(u.price).toLocaleString()} ر.س`} />
                    <Row label="الحالة" value={u.status === "rented" ? "مؤجرة" : u.status} />
                  </dl>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "invoices" && (
          <div>
            <div className="mb-3 flex gap-2">
              {[
                { id: "all", label: "الكل" },
                { id: "unpaid", label: "غير مدفوعة" },
                { id: "paid", label: "مدفوعة" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${filter === f.id ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">لا توجد فواتير</div>
              ) : (
                filtered.map((inv) => {
                  const u = units.find((x) => x.id === inv.unit_id);
                  return (
                    <div key={inv.id} className={`rounded-xl border p-4 ${inv.paid ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/30"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          <span className="font-bold">{Number(inv.amount).toLocaleString()} ر.س</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${inv.paid ? "bg-emerald-500/20 text-emerald-700" : "bg-amber-500/20 text-amber-700"}`}>
                            {inv.paid ? "مدفوعة" : "غير مدفوعة"}
                          </span>
                        </div>
                        {inv.due_date && <span className="text-xs text-muted-foreground">استحقاق: {inv.due_date}</span>}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {u && <>مبنى {u.building_number} وحدة {u.unit_number} · </>}
                        {inv.period_start && <>الفترة: {inv.period_start} → {inv.period_end} · </>}
                        {inv.paid_at && <>تاريخ السداد: {new Date(inv.paid_at).toLocaleDateString("ar-EG-u-nu-latn")} · </>}
                        {inv.notes}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "profile" && account && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-sm">
            <Row label="الاسم" value={account.full_name} />
            <Row label="الإيميل" value={account.email || "—"} />
            <Row label="الجوال" value={account.phone || "—"} />
            <Row label="النشاط" value={account.business_name || "—"} />
            <p className="pt-3 text-xs text-muted-foreground">لتعديل بياناتك تواصل مع الإدارة.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

const Stat = ({ label, value, accent }: { label: string; value: any; accent?: string }) => (
  <div className="rounded-xl bg-secondary p-3">
    <div className={`font-bold ${accent === "destructive" ? "text-destructive" : "text-primary"}`}>{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);
const Row = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);
