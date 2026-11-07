import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAccess } from "@/lib/accessLog";
import type { Session, User } from "@supabase/supabase-js";

/**
 * One shared sign-in state for the whole app.
 *
 * Every page reads the same session and roles, so leaving the tab and coming back
 * (which makes the auth client re-announce the session) never shows a page a
 * temporary "signed out / no role" state that would redirect the user away.
 */
type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: string[];
  permissions: Record<string, string[]>;
};

let state: AuthState = { session: null, user: null, loading: true, roles: [], permissions: {} };
const listeners = new Set<() => void>();
let started = false;
let activeUser: string | null = null;
let rolesRequest: { uid: string; promise: Promise<void> } | null = null;

const setState = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Loads roles for the given user; retries temporary network failures (common right after
// the phone wakes the tab) instead of treating the user as having no role.
const loadRoles = (uid: string): Promise<void> => {
  if (rolesRequest?.uid === uid) return rolesRequest.promise;
  const promise = (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (activeUser !== uid) return;
      const accepted = await supabase.rpc("accept_my_staff_invitation");
      if (activeUser !== uid) return;
      if (!accepted.error) {
        const { data, error } = await supabase.rpc("my_permissions");
        if (activeUser !== uid) return;
        if (!error) {
          const result = data as unknown as { roles: string[]; permissions: { capability: string; levels: string[] }[] } | null;
          setState({
            roles: result?.roles ?? [],
            permissions: Object.fromEntries((result?.permissions ?? []).map((p) => [p.capability, p.levels])),
          });
          return;
        }
      }
      await wait(600 * (attempt + 1));
    }
  })().finally(() => {
    if (rolesRequest?.promise === promise) rolesRequest = null;
    if (activeUser === uid && state.loading) setState({ loading: false });
  });
  rolesRequest = { uid, promise };
  return promise;
};

const applySession = (sess: Session | null) => {
  const nextUser = sess?.user.id ?? null;
  const identityChanged = nextUser !== activeUser;
  activeUser = nextUser;
  if (identityChanged) {
    // Only a different person (or sign-out) clears roles and shows loading.
    setState({ session: sess, user: sess?.user ?? null, roles: [], permissions: {}, loading: nextUser !== null });
  } else {
    // Same person: keep the same user object so pages don't reset their forms.
    setState({ session: sess });
  }
  if (nextUser) void loadRoles(nextUser);
};

const start = () => {
  if (started) return;
  started = true;

  supabase.auth.onAuthStateChange((event, sess) => {
    if (event === "SIGNED_IN" && sess?.user) {
      const key = `access_logged_${sess.user.id}_${sess.access_token.slice(-12)}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        logAccess("sign_in", {
          user_id: sess.user.id,
          email: sess.user.email ?? null,
          phone: sess.user.phone ?? null,
        });
      }
    }
    if (event === "USER_UPDATED" && sess?.user && sess.user.id === activeUser) {
      setState({ user: sess.user });
    }
    // Defer so we never call the auth client from inside its own callback.
    setTimeout(() => applySession(sess), 0);
  });

  supabase.auth.getSession().then(({ data }) => {
    applySession(data.session);
    if (!data.session) setState({ loading: false });
  });
};

const subscribe = (listener: () => void) => {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;

export const useAuth = () => {
  const { session, user, loading, roles, permissions } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isAdmin = roles.includes("admin");
  // Manager is read-only: only admins can perform write actions on admin surfaces.
  const canEdit = isAdmin;
  const can = (capability: string, level = "view") => permissions[capability]?.includes(level) ?? false;
  return {
    session,
    user,
    loading,
    isAdmin,
    isControl: roles.includes("control"),
    isManager: roles.includes("manager"),
    isTenant: roles.includes("tenant"),
    isLeasingManager: roles.includes("leasing_manager"),
    isSalesAgent: roles.includes("sales_agent"),
    isAccountant: roles.includes("accountant"),
    isInvestor: roles.includes("investor") || roles.includes("investor_viewer"),
    canEdit,
    can,
    permissions,
  };
};
