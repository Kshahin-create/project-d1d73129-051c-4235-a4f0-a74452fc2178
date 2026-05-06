import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const MOBILE_BRIDGE_KEY = "mobile_oauth_bridge";

export const bridgeToMobile = async (
  redirectUri: string,
  next: string,
  provider: string,
) => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("No session");

  const url =
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mobile-token-issue` +
    `?provider=${encodeURIComponent(provider)}` +
    `&next=${encodeURIComponent(next)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&format=json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "x-refresh-token": session.refresh_token,
    },
  });
  if (!res.ok) throw new Error(`Token issue failed: ${res.status}`);
  const body = await res.json();
  window.location.href = body.deeplink as string;
};

const AuthMobileStart = () => {
  const [params] = useSearchParams();
  const provider = (params.get("provider") || "google") as "google" | "apple";
  const next = params.get("next") || "/dashboard";
  const redirectUri = params.get("redirect_uri") || "ejar-auth://auth";
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        sessionStorage.setItem(
          MOBILE_BRIDGE_KEY,
          JSON.stringify({ redirect_uri: redirectUri, next, provider }),
        );

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await bridgeToMobile(redirectUri, next, provider);
          return;
        }

        const result = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: `${window.location.origin}/auth?mobile=1`,
        });
        if (result.error) {
          setError(result.error.message);
          return;
        }
        if (result.redirected) return;

        await bridgeToMobile(redirectUri, next, provider);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [provider, next, redirectUri]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          {error ? `خطأ: ${error}` : "جاري تسجيل الدخول..."}
        </p>
      </div>
    </div>
  );
};

export default AuthMobileStart;
export { MOBILE_BRIDGE_KEY };
