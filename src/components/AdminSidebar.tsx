import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Shield,
  CalendarRange,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
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

  // Reserve horizontal space on the page so the sidebar never covers content.
  // The sidebar is fixed on the LEFT (since the site is RTL, content sits on the right).
  useEffect(() => {
    if (loading || !user || !isAdmin) {
      document.body.style.paddingLeft = "";
      return;
    }
    const apply = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      document.body.style.paddingLeft = isDesktop
        ? collapsed
          ? "56px"
          : "224px"
        : "";
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.body.style.paddingLeft = "";
    };
  }, [collapsed, isAdmin, user, loading]);

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
      {/* Mobile open button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
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

      {/* Sidebar — fixed on LEFT (page is RTL, main content is on the right) */}
      <aside
        dir="rtl"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-l border-border bg-card shadow-elevated transition-all duration-300",
          // Width
          collapsed ? "lg:w-14" : "lg:w-56",
          "w-60",
          // Mobile slide
          mobileOpen ? "translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          {!collapsed && (
            <span className="truncate text-sm font-bold">لوحة الأدمن</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-7 w-7 items-center justify-center rounded-md hover:bg-secondary lg:inline-flex"
            aria-label="طي القائمة"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
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
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
            title="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
          {!collapsed && user.email && (
            <div className="truncate px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
              {user.email}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
