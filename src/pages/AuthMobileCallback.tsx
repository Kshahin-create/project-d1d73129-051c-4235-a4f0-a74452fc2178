import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const isAndroid = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const buildIntentUrl = (token: string, provider: string, next: string) => {
  const fallback = `${window.location.origin}/auth/mobile-callback?token=${encodeURIComponent(
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
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const provider = params.get("provider") || "google";
  const nextParam = params.get("next") || "/dashboard";
  const tokenFromQuery = params.get("token") || "";

  const [status, setStatus] = useState<
    "exchanging" | "ready-to-app" | "signed-in" | "error"
  >(tokenFromQuery ? "exchanging" : "ready-to-app");
  const [error, setError] = useState<string | null>(null);
  const [appLinkToken, setAppLinkToken] = useState<string>(
    tokenFromQuery ? "" : "",
  );

  // If a token is present in URL → we're inside the app's WebView; exchange it.
  useEffect(() => {
    if (!tokenFromQuery) return;
    let cancelled = false;
    (async () => {
      try {
        const url =
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mobile-token-exchange`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenFromQuery }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Exchange failed: ${res.status}`);
        }
        const body = await res.json();
        const { error: setErr } = await supabase.auth.setSession({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        });
        if (setErr) throw setErr;
        if (cancelled) return;
        setStatus("signed-in");
        const dest = body.next || nextParam;
        setTimeout(() => navigate(dest), 200);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenFromQuery, navigate, nextParam]);

  // No token in URL: show "Return to app" button using current session as bridge.
  useEffect(() => {
    if (tokenFromQuery) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (!cancelled) setStatus("error");
        if (!cancelled) setError("لا توجد جلسة نشطة");
        return;
      }
      try {
        const url =
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mobile-token-issue?provider=${provider}&next=${encodeURIComponent(nextParam)}&redirect_uri=${encodeURIComponent("ejar-auth://auth")}&format=json`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-refresh-token": session.refresh_token,
          },
        });
        if (!res.ok) throw new Error(`Issue failed: ${res.status}`);
        const body = await res.json();
        if (!cancelled) {
          setAppLinkToken(body.token);
          setStatus("ready-to-app");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenFromQuery, provider, nextParam]);

  const appUrl = useMemo(() => {
    if (!appLinkToken) return "";
    return isAndroid()
      ? buildIntentUrl(appLinkToken, provider, nextParam)
      : buildEjarUrl(appLinkToken, provider, nextParam);
  }, [appLinkToken, provider, nextParam]);

  if (status === "exchanging" || status === "signed-in") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            {status === "signed-in" ? "تم تسجيل الدخول..." : "جاري التحقق..."}
          </p>
        </div>
      </div>
    );
  }

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

        {appUrl ? (
          <a
            href={appUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated"
          >
            العودة إلى التطبيق
          </a>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">
            {error ? `خطأ: ${error}` : "جاري التحضير..."}
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
