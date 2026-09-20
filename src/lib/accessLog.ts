import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget access logging (IP + geo captured server side).
 * Never blocks or breaks the auth flow.
 */
export const logAccess = (
  event: string,
  info: { user_id?: string | null; phone?: string | null; email?: string | null } = {},
) => {
  try {
    void supabase.functions.invoke("log-access", {
      body: { event, path: window.location.pathname, ...info },
    });
  } catch {
    /* ignore */
  }
};
