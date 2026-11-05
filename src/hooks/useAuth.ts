import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAccess } from "@/lib/accessLog";
import type { Session, User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isControl, setIsControl] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isTenant, setIsTenant] = useState(false);
  const [isLeasingManager, setIsLeasingManager] = useState(false);
  const [isSalesAgent, setIsSalesAgent] = useState(false);
  const [isInvestor,setIsInvestor]=useState(false);
  const [isAccountant, setIsAccountant] = useState(false);
  const [permissions,setPermissions]=useState<Record<string,string[]>>({});

  useEffect(() => {
    const fetchRoles = async (uid: string) => {
      await supabase.rpc('accept_my_staff_invitation');
      const {data}=await supabase.rpc('my_permissions');
      const result=data as unknown as {roles:string[];permissions:{capability:string;levels:string[]}[]}|null;
      const roles=result?.roles??[];
      setPermissions(Object.fromEntries((result?.permissions??[]).map(p=>[p.capability,p.levels])));
      setIsAdmin(roles.includes("admin"));
      setIsControl(roles.includes("control"));
      setIsManager(roles.includes("manager"));
      setIsTenant(roles.includes("tenant"));
      setIsLeasingManager(roles.includes("leasing_manager"));
      setIsSalesAgent(roles.includes("sales_agent"));
      setIsAccountant(roles.includes("accountant"));
      setIsInvestor(roles.includes("investor")||roles.includes('investor_viewer'));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
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
      if (sess?.user) {
        setTimeout(() => fetchRoles(sess.user.id), 0);
      } else {
        setIsAdmin(false);
        setIsControl(false);
        setIsManager(false);
        setIsTenant(false);
        setIsLeasingManager(false);
        setIsSalesAgent(false);
        setIsAccountant(false);
        setIsInvestor(false);
        setPermissions({});
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await fetchRoles(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Manager is read-only: only admins can perform write actions on admin surfaces.
  const canEdit = isAdmin;
  const can=(capability:string,level='view')=>permissions[capability]?.includes(level)??false;
  return { session, user, loading, isAdmin, isControl, isManager, isTenant, isLeasingManager, isSalesAgent, isAccountant, isInvestor, canEdit,can,permissions };
};
