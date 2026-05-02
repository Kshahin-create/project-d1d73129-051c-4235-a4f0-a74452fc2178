import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, MailX } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status =
  | "loading"
  | "valid"
  | "already"
  | "invalid"
  | "confirming"
  | "success"
  | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const data = await res.json();
        if (res.ok && data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus("confirming");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
      } else if (data.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setErrorMsg(data.error || "حدث خطأ");
        setStatus("error");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "حدث خطأ");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">جاري التحقق...</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="w-14 h-14 mx-auto mb-4 text-primary" />
              <h1 className="text-2xl font-bold mb-3">إلغاء الاشتراك</h1>
              <p className="text-muted-foreground mb-6">
                هل أنت متأكد أنك تريد إلغاء الاشتراك من إيميلات MNI City؟ لن
                تستلم رسائل تأكيد الحجز أو الإشعارات بعد ذلك.
              </p>
              <Button onClick={handleConfirm} className="w-full" size="lg">
                تأكيد إلغاء الاشتراك
              </Button>
            </>
          )}

          {status === "confirming" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">جاري المعالجة...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-600" />
              <h1 className="text-2xl font-bold mb-3">تم إلغاء الاشتراك</h1>
              <p className="text-muted-foreground">
                تم إلغاء اشتراكك بنجاح. لن تستلم منا رسائل بعد الآن.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
              <h1 className="text-2xl font-bold mb-3">سبق إلغاء الاشتراك</h1>
              <p className="text-muted-foreground">
                هذا البريد ملغى الاشتراك بالفعل.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <AlertCircle className="w-14 h-14 mx-auto mb-4 text-destructive" />
              <h1 className="text-2xl font-bold mb-3">رابط غير صالح</h1>
              <p className="text-muted-foreground">
                الرابط غير صالح أو منتهي الصلاحية.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="w-14 h-14 mx-auto mb-4 text-destructive" />
              <h1 className="text-2xl font-bold mb-3">خطأ</h1>
              <p className="text-muted-foreground mb-4">{errorMsg}</p>
              <Button onClick={handleConfirm} variant="outline">
                إعادة المحاولة
              </Button>
            </>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
