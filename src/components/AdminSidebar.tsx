import { useEffect, useMemo, useState } from "react";
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
  ChevronDown,
  Menu,
  X,
  UserCircle2,
  User,
  Users,
  History,
  ClipboardList,
  KeyRound,
  Code2,
  Wrench,
  Activity,
  Bot,
  MessageCircle,
  FileSpreadsheet,
  Database,
  Compass,
  Briefcase,
  Settings2,
  Terminal,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ExtLink = {
  to: string;
  label: string;
  Icon: typeof Home;
  adminOnly?: boolean;
  controlOnly?: boolean;
  authOnly?: boolean;
  managerOnly?: boolean;
  tenantOnly?: boolean;
};

type LinkGroup = {
  id: string;
  label: string;
  Icon: typeof Home;
  links: ExtLink[];
};

const groups: LinkGroup[] = [
  {
    id: "general",
    label: "عام",
    Icon: Compass,
    links: [
      { to: "/", label: "الرئيسية", Icon: Home },
      { to: "/booking", label: "احجز وحدتك", Icon: CalendarRange },
      { to: "/profile", label: "حسابي", Icon: User, authOnly: true },
      { to: "/tenant", label: "وحداتي وفواتيري", Icon: ClipboardList, tenantOnly: true },
    ],
  },
  {
    id: "dashboards",
    label: "اللوحات",
    Icon: LayoutDashboard,
    links: [
      { to: "/dashboard", label: "الداشبورد العام", Icon: LayoutDashboard, managerOnly: true },
      { to: "/admin", label: "لوحة الأدمن", Icon: Shield, adminOnly: true },
      { to: "/control", label: "لوحة الكنترول", Icon: Wrench, controlOnly: true },
    ],
  },
  {
    id: "operations",
    label: "العمليات",
    Icon: Briefcase,
    links: [
      { to: "/admin/bookings", label: "الحجوزات", Icon: CalendarRange, managerOnly: true },
      { to: "/admin/tenant-accounts", label: "المستأجرون", Icon: ClipboardList, managerOnly: true },
      { to: "/admin/interested", label: "المهتمون", Icon: MessageCircle, managerOnly: true },
      { to: "/admin/leads", label: "المستهدفون", Icon: MessageCircle, adminOnly: true },
    ],
  },
  {
    id: "system",
    label: "النظام",
    Icon: Settings2,
    links: [
      { to: "/admin/users", label: "المستخدمون", Icon: Users, adminOnly: true },
      { to: "/admin/audit", label: "سجل التدقيق", Icon: History, adminOnly: true },
      { to: "/admin/sheets-sync", label: "مزامنة الشييت", Icon: FileSpreadsheet, managerOnly: true },
      { to: "/admin/backup", label: "نسخ احتياطي", Icon: Database, adminOnly: true },
    ],
  },
  {
    id: "developers",
    label: "المطورون",
    Icon: Terminal,
    links: [
      { to: "/admin/stats", label: "إحصائيات السيرفر", Icon: Activity, adminOnly: true },
      { to: "/admin/api-keys", label: "مفاتيح الـ API", Icon: KeyRound, adminOnly: true },
      { to: "/api-docs", label: "توثيق الـ API", Icon: Code2, adminOnly: true },
      { to: "/mcp", label: "خادم MCP", Icon: Bot, adminOnly: true },
    ],
  },
];

export const AdminSidebar = () => {
  const { isAdmin, isControl, isManager, isTenant, user, loading } = useAuth();
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

  const visibleGroups = useMemo(() => {
    const canSee = (l: ExtLink) =>
      (!l.adminOnly || isAdmin) &&
      (!l.controlOnly || isControl || isAdmin || isManager) &&
      (!l.managerOnly || isManager || isAdmin) &&
      (!l.tenantOnly || isTenant) &&
      (!l.authOnly || !!user);
    return groups
      .map((g) => ({ ...g, links: g.links.filter(canSee) }))
      .filter((g) => g.links.length > 0);
  }, [isAdmin, isControl, isManager, isTenant, user]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // auto-open the group that contains the active route
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of visibleGroups) {
        if (g.links.some((l) => l.to === pathname)) next[g.id] = true;
      }
      return next;
    });
  }, [pathname, visibleGroups]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const title = isAdmin
    ? "لوحة الأدمن"
    : isManager
      ? "لوحة المدير"
      : isControl
        ? "لوحة الكنترول"
        : "القائمة";

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

        {/* Groups */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {visibleGroups.map((group) => {
            const GroupIcon = group.Icon;
            const isOpen = openGroups[group.id] ?? false;
            const hasActive = group.links.some((l) => l.to === pathname);

            if (collapsed) {
              // In collapsed mode, just render icons flat
              return (
                <div key={group.id} className="flex flex-col gap-1">
                  {group.links.map(({ to, label, Icon }) => {
                    const active = pathname === to;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        title={`${group.label} — ${label}`}
                        className={cn(
                          "flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-secondary",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </NavLink>
                    );
                  })}
                  <div className="my-1 border-t border-border/60" />
                </div>
              );
            }

            return (
              <div key={group.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((p) => ({ ...p, [group.id]: !isOpen }))
                  }
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                    hasActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span>{group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isOpen ? "rotate-180" : "",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="mt-1 flex flex-col gap-0.5 pr-3">
                    {group.links.map(({ to, label, Icon }) => {
                      const active = pathname === to;
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-secondary",
                          )}
                          title={label}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
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
