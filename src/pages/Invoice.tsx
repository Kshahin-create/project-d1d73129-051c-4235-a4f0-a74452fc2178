import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, ArrowLeft, BadgeCheck } from "lucide-react";

type Inv = {
  id: string;
  invoice_number: string | null;
  amount: number;
  paid_amount: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_business: string | null;
  cr_number: string | null;
  booking_id: string | null;
  tenant_account_id: string | null;
  unit_id: string | null;
  created_at: string;
};

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Inv | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.rpc("get_invoice_for_view" as any, { _invoice_id: id });
      if (error) setErr(error.message);
      else if (Array.isArray(data) && data.length > 0) setInv(data[0] as any);
      else setErr("الفاتورة غير موجودة أو لا تملك صلاحية");
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (err || !inv) return <div className="grid min-h-screen place-items-center text-center"><div><p className="font-display text-lg">{err || "غير موجود"}</p><Link to="/" className="mt-4 inline-block text-primary underline">العودة</Link></div></div>;

  const dateStr = new Date(inv.paid_at || inv.created_at).toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = new Date(inv.paid_at || inv.created_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
  const amount = Number(inv.amount).toLocaleString("en-US");

  const methodLabel: Record<string, string> = { cash: "نقداً", transfer: "تحويل بنكي", card: "بطاقة", check: "شيك" };
  const method = methodLabel[inv.payment_method || ""] || inv.payment_method || "—";

  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:px-0">
        <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
          <Link to="/tenant" className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> رجوع
          </Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Printer className="h-4 w-4" /> طباعة
          </button>
        </div>

        <article className="relative overflow-hidden rounded-xl border-2 border-border bg-white text-slate-900 shadow-lg print:rounded-none print:border-0 print:shadow-none">
          {/* Watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
            <div className="rotate-[-25deg] text-[140px] font-black tracking-widest">PAID</div>
          </div>

          {/* Header band */}
          <header className="flex items-stretch justify-between gap-4 border-b-4 border-primary bg-gradient-to-l from-primary/10 to-primary/5 p-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold leading-tight text-slate-900">شركة نخبة تسكين العقارية</h1>
              <p className="mt-1 text-xs text-slate-600">المدينة الصناعية - شمال مكة المكرمة</p>
              <p className="text-xs text-slate-600">المملكة العربية السعودية</p>
            </div>
            <div className="text-right">
              <div className="rounded-md border border-primary/30 bg-white px-3 py-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">سند قبض / فاتورة</div>
                <div className="font-mono text-sm font-bold text-primary">{inv.invoice_number || "—"}</div>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                <div>التاريخ: <span className="font-semibold">{dateStr}</span></div>
                <div>الوقت: <span className="font-semibold">{timeStr}</span></div>
              </div>
            </div>
          </header>

          {/* Customer */}
          <section className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">بيانات العميل</h2>
              <dl className="space-y-1 text-sm">
                <Field label="الاسم" value={inv.customer_name} />
                <Field label="الجوال" value={inv.customer_phone} />
                <Field label="النشاط" value={inv.customer_business} />
                <Field label="الرقم الوطني الموحد" value={inv.cr_number} />
              </dl>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">تفاصيل الدفع</h2>
              <dl className="space-y-1 text-sm">
                <Field label="طريقة الدفع" value={method} />
                <Field label="حالة الفاتورة" value={inv.paid ? "مسددة" : "غير مسددة"} />
                {inv.notes && <Field label="ملاحظات" value={inv.notes} />}
              </dl>
            </div>
          </section>

          {/* Amount table */}
          <section className="px-6">
            <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-right font-semibold">البيان</th>
                  <th className="p-3 text-right font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="p-3">دفعة من قيمة الإيجار</td>
                  <td className="p-3 text-right font-mono font-bold">{amount} ر.س</td>
                </tr>
                <tr className="border-t-2 border-slate-300 bg-primary/5">
                  <td className="p-3 font-bold">الإجمالي المدفوع</td>
                  <td className="p-3 text-right font-mono text-base font-extrabold text-primary">{amount} ر.س</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Stamp area */}
          <section className="grid grid-cols-2 gap-4 p-6 pt-8">
            <div className="text-center">
              <div className="mx-auto h-16 border-b border-slate-300" />
              <div className="mt-1 text-xs text-slate-500">توقيع المستلم</div>
            </div>
            <div className="relative text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center">
                {/* Stamp */}
                <div className="relative flex h-28 w-28 rotate-[-12deg] items-center justify-center rounded-full border-[3px] border-emerald-600 text-emerald-700">
                  <div className="absolute inset-2 rounded-full border border-emerald-600/60" />
                  <div className="text-center">
                    <BadgeCheck className="mx-auto h-5 w-5" />
                    <div className="text-[10px] font-bold leading-tight">تم الاستلام</div>
                    <div className="text-[9px] font-semibold leading-tight">نخبة تسكين</div>
                    <div className="mt-0.5 text-[8px] opacity-70">{dateStr}</div>
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">ختم الشركة</div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-slate-50 p-4 text-center text-[11px] text-slate-500">
            هذه الفاتورة صادرة إلكترونياً وتعتبر سارية بدون توقيع. لأي استفسار يرجى التواصل مع الإدارة.
          </footer>
        </article>
      </div>
    </div>
  );
}

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-semibold">{value || "—"}</dd>
  </div>
);
