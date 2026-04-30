import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Shield,
  CalendarRange,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin", label: "لوحة الأدمن", Icon: Shield },
  { to: "/dashboard", label: "الداشبورد العام", Icon: LayoutDashboard },
  { to: "/", label: "الصفحة الرئيسية", Icon: Home },
  { to: "/booking", label: "الحجوزات", Icon: CalendarRange },
];

export const AdminSidebar = () => {
  const { isAdmin, user, loading } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user || !isAdmin) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <>
      {/* Mobile toggle button */}
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

      {/* Sidebar */}
      <aside
        dir="rtl"
        className={cn(
          "fixed top-1/2 z-50 -translate-y-1/2 transition-all duration-300",
          // Position on right (RTL) for desktop
          "right-3",
          // Visibility
          mobileOpen ? "translate-x-0" : "max-lg:translate-x-[120%]",
          collapsed ? "lg:w-14" : "lg:w-56",
          "w-60",
        )}
      >
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-elevated backdrop-blur">
          {/* Header / collapse */}
          <div className="flex items-center justify-between px-2 py-1">
            {!collapsed && (
              <span className="truncate text-xs font-bold text-muted-foreground">
                لوحة الأدمن
              </span>
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
          </div>

          <nav className="flex flex-col gap-1">
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

          <div className="my-1 h-px bg-border" />

          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10",
            )}
            title="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>

          {!collapsed && user.email && (
            <div className="truncate px-3 pb-1 pt-1 text-[10px] text-muted-foreground">
              {user.email}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
