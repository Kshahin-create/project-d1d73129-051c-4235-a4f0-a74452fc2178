import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const isAndroid = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const buildIntentUrl = (token: string, provider: string, next: string) => {
  const fallback = `https://ejar.mnicity.com/auth/mobile-callback?token=${encodeURIComponent(
    token,
  )}&provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;
  const path = `auth?token=${encodeURIComponent(token)}&provider=${encodeURIComponent(
    provider,
  )}&next=${encodeURIComponent(next)}`;
  return `intent://${path}#Intent;scheme=ejar;package=com.mnicity.ejar;S.browser_fallback_url=${encodeURIComponent(
    fallback,
  )};end`;
};

const buildEjarUrl = (token: string, provider: string, next: string) =>
  `ejar://auth?token=${encodeURIComponent(token)}&provider=${encodeURIComponent(
    provider,
  )}&next=${encodeURIComponent(next)}`;

const AuthMobileCallback = () => {
  const [params] = useSearchParams();
  const provider = params.get("provider") || "google";
  const next = params.get("next") || "/dashboard";
  const tokenFromQuery = params.get("token") || "";
  const [token, setToken] = useState<string>(tokenFromQuery);
  const [ready, setReady] = useState<boolean>(!!tokenFromQuery);

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const t = data.session?.access_token || "";
      setToken(t);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const appUrl = useMemo(() => {
    if (!token) return "";
    return isAndroid()
      ? buildIntentUrl(token, provider, next)
      : buildEjarUrl(token, provider, next);
  }, [token, provider, next]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold">
          تم تسجيل الدخول
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اضغط الزر أدناه للعودة إلى تطبيق إيجار
        </p>

        {ready && appUrl ? (
          <a
            href={appUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated"
          >
            العودة إلى التطبيق
          </a>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">
            جاري التحضير...
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          إذا لم يفتح التطبيق تلقائياً، تأكد من تثبيته على جهازك.
        </p>
      </div>
    </div>
  );
};

export default AuthMobileCallback;
