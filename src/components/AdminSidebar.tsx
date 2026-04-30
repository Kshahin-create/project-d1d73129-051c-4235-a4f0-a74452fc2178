import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Shield,
  CalendarRange,
  LogOut,
  LogIn,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  UserCircle2,
  User,
  Users,
  History,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LinkItem = {
  to: string;
  label: string;
  Icon: typeof Home;
  adminOnly?: boolean;
};

const allLinks: (LinkItem & { authOnly?: boolean })[] = [
  { to: "/", label: "الرئيسية", Icon: Home },
  { to: "/booking", label: "احجز وحدتك", Icon: CalendarRange },
  { to: "/profile", label: "حسابي", Icon: User, authOnly: true },
  { to: "/dashboard", label: "الداشبورد العام", Icon: LayoutDashboard, adminOnly: true },
  { to: "/admin", label: "لوحة الأدمن", Icon: Shield, adminOnly: true },
];

export const AdminSidebar = () => {
  const { isAdmin, user, loading } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Reserve horizontal space on the page so the sidebar never covers content.
  // Sidebar is fixed on the RIGHT (Arabic / RTL layout).
  useEffect(() => {
    if (loading) {
      document.body.style.paddingRight = "";
      document.body.style.paddingLeft = "";
      return;
    }
    const apply = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      document.body.style.paddingRight = isDesktop
        ? collapsed
          ? "56px"
          : "224px"
        : "";
      document.body.style.paddingLeft = "";
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.body.style.paddingRight = "";
    };
  }, [collapsed, loading]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading) return null;

  const links = allLinks.filter(
    (l) => (!l.adminOnly || isAdmin) && (!l.authOnly || !!user),
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const title = isAdmin ? "لوحة الأدمن" : "القائمة";

  return (
    <>
      {/* Mobile open button — bottom-right for RTL */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on RIGHT for Arabic/RTL */}
      <aside
        dir="rtl"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-card shadow-elevated transition-all duration-300",
          collapsed ? "lg:w-14" : "lg:w-56",
          "w-60",
          mobileOpen ? "translate-x-0" : "max-lg:translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          {!collapsed && (
            <span className="truncate text-sm font-bold">{title}</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-7 w-7 items-center justify-center rounded-md hover:bg-secondary lg:inline-flex"
            aria-label="طي القائمة"
          >
            {collapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary lg:hidden"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {links.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
                title={label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2">
          {user ? (
            <>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>تسجيل الخروج</span>}
              </button>
              {!collapsed && user.email && (
                <div className="flex items-center gap-2 truncate px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
                  <UserCircle2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
            </>
          ) : (
            <NavLink
              to="/auth"
              className="flex w-full items-center gap-3 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              title="تسجيل الدخول"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              {!collapsed && <span>تسجيل الدخول</span>}
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
};
