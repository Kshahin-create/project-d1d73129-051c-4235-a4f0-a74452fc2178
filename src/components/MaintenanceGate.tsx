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
      const { data } = await supabase
        .from("app_settings")
        .select("maintenance_mode, maintenance_message")
        .eq("id", 1)
        .maybeSingle();
      if (!mounted) return;
      setEnabled(!!data?.maintenance_mode);
      setMessage(data?.maintenance_message ?? null);
    };
    load();

    const channel = supabase
      .channel("app_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (row) {
            setEnabled(!!row.maintenance_mode);
            setMessage(row.maintenance_message ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
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
