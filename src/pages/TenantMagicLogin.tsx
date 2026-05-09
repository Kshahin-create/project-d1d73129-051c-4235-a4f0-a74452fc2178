import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";

export default function TenantMagicLogin() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("tenant-magic-login", {
          body: { token },
        });
        if (error) throw error;
        const r = data as any;
        if (r?.error) throw new Error(r.error);
        if (!r?.access_token) throw new Error("استجابة غير متوقعة");
        const { error: setErr } = await supabase.auth.setSession({
          access_token: r.access_token,
          refresh_token: r.refresh_token,
        });
        if (setErr) throw setErr;
        nav("/tenant", { replace: true });
      } catch (e: any) {
        setError(e?.message || "تعذّر تسجيل الدخول");
      }
    })();
  }, [token, nav]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        {error ? (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-3 font-display text-lg font-bold">فشل الدخول</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button onClick={() => nav("/auth")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              تسجيل دخول عادي
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 text-sm">جاري تسجيل الدخول...</p>
          </>
        )}
      </div>
    </div>
  );
}
