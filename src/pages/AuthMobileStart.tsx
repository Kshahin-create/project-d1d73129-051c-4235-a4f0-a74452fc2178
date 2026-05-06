import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const MOBILE_BRIDGE_KEY = "mobile_oauth_bridge";

const issueAndRedirect = async (
  redirectUri: string,
  next: string,
  provider: string,
) => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return false;

  const url =
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mobile-token-issue` +
    `?provider=${encodeURIComponent(provider)}` +
    `&next=${encodeURIComponent(next)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  // We must NOT follow redirect via fetch (it strips the custom scheme).
  // Use a top-level navigation through a 302; do that by hitting the URL
  // server-side and then navigating window.location to the returned Location.
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "x-refresh-token": session.refresh_token,
    },
  });

  // Browsers expose opaqueredirect when redirect:'manual' — we can't read Location.
  // Fallback: ask the function for a JSON token (no redirect) by reading body when status is opaque.
  // Simplest: open the function URL directly in the browser so the 302 fires natively.
  // Append auth via short-lived query? The function requires Authorization header.
  // Instead: do the request with redirect:'follow' to obtain token, then build the deeplink ourselves.

  if (res.type === "opaqueredirect" || res.status === 0 || res.status === 302) {
    // Re-do with follow to get final body? The 302 target is a custom scheme — fetch will fail.
    // So: re-issue with a small JSON-mode by calling a sibling: we'll just reconstruct by parsing.
    // Easiest path: do a follow request to a JSON variant — but we only built the 302 endpoint.
    // Workaround: navigate the browser directly. We need to attach Authorization — not possible via <a>.
    // So: call again expecting we can read body when status >=300. We can't.
    // Instead, fetch with redirect:'follow' and catch the network error, then parse from response URL.
    return false;
  }
  return false;
};

const AuthMobileStart = () => {
  const [params] = useSearchParams();
  const provider = (params.get("provider") || "google") as
    | "google"
    | "apple";
  const next = params.get("next") || "/dashboard";
  const redirectUri = params.get("redirect_uri") || "ejar-auth://auth";
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // Persist bridge intent so /auth (post-OAuth) knows to issue + redirect to mobile.
        sessionStorage.setItem(
          MOBILE_BRIDGE_KEY,
          JSON.stringify({ redirect_uri: redirectUri, next, provider }),
        );

        // If already signed in, skip OAuth and go straight to issuing token.
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

        // No redirect happened — session set in-place. Bridge now.
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

  // Call with JSON mode? Our function only does 302. Add JSON path: when ?format=json, return body.
  // Since function returns 302 with custom scheme — fetch can't follow. We use JSON variant.
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "x-refresh-token": session.refresh_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ format: "json" }),
  });

  if (!res.ok) {
    throw new Error(`Token issue failed: ${res.status}`);
  }
  const body = await res.json();
  const deeplink = `${redirectUri}?token=${encodeURIComponent(
    body.token,
  )}&provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;

  window.location.href = deeplink;
};

export default AuthMobileStart;
