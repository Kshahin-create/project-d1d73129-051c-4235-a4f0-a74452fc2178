import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/delete-account");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("account_deletion_requests")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => setHasPending(!!data));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (confirm.trim() !== "حذف") {
      toast.error('اكتب كلمة "حذف" للتأكيد');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("account_deletion_requests").insert({
      user_id: user.id,
      email: user.email,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إرسال الطلب، حاول لاحقاً");
      return;
    }
    setSubmitted(true);
    setHasPending(true);
    toast.success("تم استلام طلب الحذف");
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-10">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/profile"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" /> العودة لحسابي
          </Link>

          <div className="rounded-2xl border border-destructive/30 bg-card p-6 shadow-card sm:p-8">
            <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold">طلب حذف الحساب وبياناتي</h1>
                <p className="text-xs text-muted-foreground">
                  حذف نهائي لحسابك وكل بياناتك المرتبطة به
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1.5">
                  <p className="font-bold">قبل ما تكمل:</p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    <li>هيتم حذف ملفك الشخصي وصورتك ورقم تواصلك.</li>
                    <li>هيتم حذف حجوزاتك وفواتيرك المرتبطة بحسابك.</li>
                    <li>قد نحتفظ ببعض البيانات التي يلزمنا حفظها قانونياً (مثل الفواتير المدفوعة) لفترة محدودة.</li>
                    <li>الحذف نهائي ولا يمكن التراجع عنه بعد التنفيذ.</li>
                  </ul>
                </div>
              </div>
            </div>

            {submitted || hasPending ? (
              <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                <p className="font-bold">تم استلام طلب الحذف</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  هنتواصل معك على{" "}
                  <span dir="ltr" className="font-mono">{user.email}</span> خلال 7 أيام عمل
                  لتأكيد تنفيذ الحذف. لو غيّرت رأيك تواصل معنا قبل التنفيذ.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">سبب الحذف (اختياري)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="ساعدنا نتحسّن، اكتب سبب طلب الحذف"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    اكتب كلمة <span className="font-bold text-destructive">حذف</span> للتأكيد
                    <span className="mr-1 text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-destructive focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || confirm.trim() !== "حذف"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3 font-display font-bold text-destructive-foreground shadow-card transition hover:opacity-90 disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {submitting ? "جاري الإرسال..." : "إرسال طلب حذف الحساب"}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  لو محتاج مساعدة، تقدر تتواصل معانا قبل تأكيد الحذف.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DeleteAccount;
