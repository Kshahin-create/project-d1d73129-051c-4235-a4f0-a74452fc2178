import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Maintenance from "@/pages/Maintenance";

// المسارات اللي مسموح بدخولها حتى في وضع الصيانة (عشان الأدمن يقدر يسجل دخول)
const ALLOWED_PATHS = ["/auth", "/admin", "/maintenance"];

export const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAuth();
  const location = useLocation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_maintenance_status");
      if (!mounted) return;
      const row = Array.isArray(data) ? data[0] : data;
      setEnabled(!!row?.maintenance_mode);
      setMessage(row?.maintenance_message ?? null);
    };
    load();
    // Poll every 30s for maintenance updates (replaces realtime which required public table access)
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // أثناء التحميل لا نعرض شيء لتفادي وميض
  if (enabled === null || loading) return <>{children}</>;

  const pathAllowed = ALLOWED_PATHS.some((p) => location.pathname.startsWith(p));

  if (enabled && !isAdmin && !pathAllowed) {
    return <Maintenance message={message} />;
  }

  return <>{children}</>;
};
