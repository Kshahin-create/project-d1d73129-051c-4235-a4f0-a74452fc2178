import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  CalendarRange,
  LogOut,
  LogIn,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
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
  Building2,
  Briefcase,
  BadgeCheck,
  Banknote,
  Settings2,
  Globe2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { activeAdminGroup, isAdminNavActive } from "@/lib/adminNavigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ExtLink = {
  to: string;
  label: string;
  Icon: typeof Home;
  adminOnly?: boolean;
  controlOnly?: boolean;
  authOnly?: boolean;
  managerOnly?: boolean;
  tenantOnly?: boolean;
  leasingOnly?: boolean;
  crmOnly?: boolean;
  crmManagerOnly?: boolean;
  financeOnly?: boolean;
  homeOnly?: boolean;
  section?: string;
};

type LinkGroup = {
  id: string;
  label: string;
  Icon: typeof Home;
  links: ExtLink[];
};

const groups: LinkGroup[] = [
  {id:"home",label:"الرئيسية",Icon:Home,links:[{to:"/admin",label:"ملخص المشروع",Icon:LayoutDashboard,homeOnly:true},{to:"/admin/tasks",label:"مهامي",Icon:ClipboardList,authOnly:true}]},
  {id:"units",label:"الوحدات",Icon:Building2,links:[
    {to:"/admin/units",label:"الخريطة والوحدات",Icon:Building2,controlOnly:true},
    {to:"/admin/units-incomplete",label:"وحدات تحتاج استكمال",Icon:ClipboardList,managerOnly:true},
    {to:"/admin/unit-status-review",label:"مراجعة حالات الوحدات",Icon:History,managerOnly:true},
  ]},
  {id:"customers",label:"العملاء والحجوزات",Icon:Users,links:[
    {to:"/admin/parties",label:"العملاء",Icon:Users,crmOnly:true},
    {to:"/admin/opportunities",label:"لوحة الفرص",Icon:Briefcase,crmOnly:true},
    {to:"/admin/bookings",label:"الحجوزات",Icon:CalendarRange,managerOnly:true},
    {to:"/leasing/holds",label:"تمديد الحجوزات",Icon:CalendarRange,leasingOnly:true},
    {to:"/admin/opportunities/unassigned",label:"غير موزعة وطلبات النقل",Icon:ClipboardList,crmManagerOnly:true},
    {to:"/admin/followup",label:"متابعة الفريق",Icon:ClipboardList,authOnly:true},
    {to:"/admin/opportunities/team",label:"أداء الفريق",Icon:Activity,crmManagerOnly:true},
    {to:"/admin/opportunities/import",label:"القائمة المستهدفة",Icon:FileSpreadsheet,crmOnly:true},
    {to:"/admin/interested",label:"المهتمون",Icon:MessageCircle,managerOnly:true},
    {to:"/admin/leads",label:"المستهدفون",Icon:MessageCircle,adminOnly:true},
    {to:"/admin/campaigns",label:"الحملات",Icon:MessageCircle,adminOnly:true},
  ]},
  {id:"tenants",label:"المستأجرون والعقود",Icon:ClipboardList,links:[
    {to:"/admin/tenant-accounts",label:"المستأجرون",Icon:Users,managerOnly:true},
    {to:"/admin/contracts",label:"العقود",Icon:ClipboardList,financeOnly:true},
  ]},
  {id:"finance",label:"المالية",Icon:Banknote,links:[
    {to:"/admin/installments",label:"الأقساط",Icon:CalendarRange,financeOnly:true},
    {to:"/admin/receipts",label:"السندات والإيصالات",Icon:Banknote,financeOnly:true},
    {to:"/admin/receipt-reconciliation",label:"المطابقة",Icon:FileSpreadsheet,financeOnly:true},
    {to:"/admin/receipt-review",label:"مراجعة المصادر القديمة",Icon:History,financeOnly:true},
    {to:"/admin/paid-tenants",label:"المسددون",Icon:BadgeCheck,managerOnly:true},
    {to:"/admin/collections-report",label:"تقارير التحصيل",Icon:Banknote,managerOnly:true},
  ]},
  {id:"settings",label:"الإعدادات",Icon:Settings2,links:[
    {section:"إدارة المشروع",to:"/admin/booking-control",label:"المباني والتحكم في الحجز",Icon:Building2,managerOnly:true},
    {to:"/admin/settings/activities",label:"الأنشطة والمباني",Icon:Building2,managerOnly:true},
    {to:"/admin/settings/payment-plans",label:"خطط السداد",Icon:CalendarRange,financeOnly:true},
    {to:"/admin/settings/unit-import",label:"استيراد الوحدات",Icon:FileSpreadsheet,managerOnly:true},
    {to:"/admin/settings/tasks",label:"المهام والتنبيهات",Icon:ClipboardList,adminOnly:true},
    {section:"المستخدمون والأمان",to:"/admin/users",label:"المستخدمون والصلاحيات",Icon:Users,adminOnly:true},
    {section:"التكاملات والنسخ الاحتياطي",to:"/admin/sheets-sync",label:"التكاملات والشييت",Icon:FileSpreadsheet,managerOnly:true},
    {to:"/admin/backup",label:"النسخ الاحتياطي",Icon:Database,adminOnly:true},
    {section:"الجودة والسجلات",to:"/admin/data-quality",label:"جودة البيانات",Icon:BadgeCheck,managerOnly:true},
    {to:"/admin/system-log",label:"سجل النظام",Icon:History,adminOnly:true},
    {to:"/admin/help",label:"المساعدة والاستعادة",Icon:Database,adminOnly:true},
    {to:"/admin/audit",label:"سجل التدقيق",Icon:History,adminOnly:true},
    {to:"/admin/access-log",label:"سجل الدخول",Icon:Globe2,adminOnly:true},
    {section:"المطورون",to:"/admin/settings/developers/api-keys",label:"مفاتيح API",Icon:KeyRound,adminOnly:true},
    {to:"/admin/settings/developers/api-docs",label:"توثيق API",Icon:Code2,adminOnly:true},
    {to:"/admin/settings/developers/mcp",label:"MCP",Icon:Bot,adminOnly:true},
    {to:"/admin/settings/developers/stats",label:"إحصائيات السيرفر",Icon:Activity,adminOnly:true},
  ]},
];

export const AdminSidebar = () => {
  const { isAdmin, isControl, isManager, isTenant, isLeasingManager, isSalesAgent, isAccountant, isInvestor, user, loading } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const compact = collapsed && desktop;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => { setDesktop(media.matches); if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [mobileOpen]);

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
          ? "72px"
          : "280px"
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

  const visibleGroups = useMemo(() => {
    const canSee = (l: ExtLink) =>
      (!l.homeOnly || isAdmin || isManager || isInvestor || isAccountant || isLeasingManager || isControl) &&
      (!l.adminOnly || isAdmin) &&
      (!l.controlOnly || isControl || isAdmin || isManager) &&
      (!l.managerOnly || isManager || isAdmin) &&
      (!l.tenantOnly || isTenant) &&
      (!l.leasingOnly || isLeasingManager) &&
      (!l.crmOnly || isAdmin || isManager || isLeasingManager || isSalesAgent) &&
      (!l.crmManagerOnly || isAdmin || isLeasingManager) &&
      (!l.financeOnly || isAdmin || isManager || isAccountant || isLeasingManager) &&
      (!l.authOnly || !!user);
    return groups
      .map((g) => ({ ...g, links: g.links.filter(canSee) }))
      .filter((g) => g.links.length > 0);
  }, [isAdmin, isControl, isManager, isTenant, isLeasingManager, isSalesAgent, isAccountant, isInvestor, user]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ home: true });
  useEffect(() => {
    // auto-open the group that contains the active route
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of visibleGroups) {
        if (g.id === activeAdminGroup(pathname)) next[g.id] = true;
      }
      return next;
    });
  }, [pathname, visibleGroups]);

  if (loading) return null;

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
        : isSalesAgent
          ? "لوحة المبيعات"
          : "القائمة";

  const renderLink = ({ to, label, Icon, section }: ExtLink) => {
    const active = isAdminNavActive(pathname, to);
    const link = (
      <NavLink key={to} to={to} aria-label={label} aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-10 items-center gap-3 rounded-md text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          compact ? "justify-center px-2" : "px-3 py-2",
          active ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground after:absolute after:inset-y-2 after:right-0 after:w-1 after:rounded-full after:bg-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/70",
        )}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <span className="min-w-0 flex-1 whitespace-normal leading-5">{label}</span>}
      </NavLink>
    );
    if (compact) return <Tooltip key={to}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="left" dir="rtl">{label}</TooltipContent></Tooltip>;
    return <div key={to}>{section && <div className="px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground">{section}</div>}{link}</div>;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Button variant="default" onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-lg shadow-elevated lg:hidden"
        aria-label="فتح القائمة" aria-expanded={mobileOpen} aria-controls="admin-navigation">
        <Menu className="h-5 w-5" />
      </Button>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <aside id="admin-navigation" dir="rtl" aria-label="القائمة الجانبية"
        className={cn("fixed inset-y-0 right-0 z-50 flex w-[min(320px,calc(100vw-32px))] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft transition-[width] duration-200 motion-reduce:transition-none",
          compact ? "lg:w-[72px]" : "lg:w-[280px]", mobileOpen ? "flex" : "max-lg:hidden")}>
        <div className={cn("flex shrink-0 items-center border-b border-sidebar-border", compact ? "flex-col gap-3 px-2 py-4" : "gap-3 px-5 py-5")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><Building2 className="h-5 w-5" /></div>
          {!compact && <div className="min-w-0 flex-1"><div className="text-lg font-bold" dir="ltr">MNICity</div><p className="mt-0.5 text-xs text-muted-foreground">{title}</p></div>}
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setCollapsed(c => !c)}
            className="hidden h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent lg:inline-flex" aria-label={compact ? "توسيع القائمة" : "طي القائمة"}>
            {compact ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button></TooltipTrigger><TooltipContent side="left">{compact ? "توسيع القائمة" : "طي القائمة"}</TooltipContent></Tooltip>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="h-8 w-8 shrink-0 lg:hidden" aria-label="إغلاق القائمة"><X className="h-4 w-4" /></Button>
        </div>
        <nav aria-label="أقسام الإدارة" className={cn("min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-4", compact ? "px-3" : "px-3")}>
          {visibleGroups.map(group => {
            const GroupIcon = group.Icon;
            const isOpen = openGroups[group.id] ?? false;
            const hasActive = group.id === activeAdminGroup(pathname);
            if (compact) return <div key={group.id} className="space-y-1 border-b border-sidebar-border pb-2 last:border-0">{group.links.map(renderLink)}</div>;
            return <div key={group.id}>
              <Button variant="ghost" type="button" aria-expanded={isOpen} aria-controls={`nav-group-${group.id}`}
                onClick={() => setOpenGroups(p => ({ ...p, [group.id]: !isOpen }))}
                className={cn("h-auto min-h-11 w-full justify-between gap-2 rounded-md px-3 py-2 text-sm font-bold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", hasActive ? "text-sidebar-primary" : "text-sidebar-foreground")}>
                <span className="flex min-w-0 items-center gap-3"><GroupIcon className="h-[18px] w-[18px] shrink-0" /><span className="whitespace-normal text-right leading-5">{group.label}</span></span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")} />
              </Button>
              {isOpen && <div id={`nav-group-${group.id}`} className="mr-5 mt-1 space-y-1 border-r border-sidebar-border pr-3">{group.links.map(renderLink)}</div>}
            </div>;
          })}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className={cn("flex gap-1", compact ? "flex-col" : "items-center justify-between")}>
            {[{ to: "/", label: "الموقع", Icon: Home }, { to: "/booking", label: "الحجز", Icon: CalendarRange }, ...(user ? [{ to: "/profile", label: "حسابي", Icon: User }] : [])].map(({ to, label, Icon }) =>
              <Tooltip key={to}><TooltipTrigger asChild><NavLink to={to} aria-label={label} className={cn("flex items-center justify-center gap-1.5 rounded-md py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring", compact ? "px-2" : "px-3")}><Icon className="h-4 w-4" />{!compact && label}</NavLink></TooltipTrigger>{compact && <TooltipContent side="left">{label}</TooltipContent>}</Tooltip>
            )}
          </div>
          {isTenant && <NavLink to="/tenant" aria-label="وحداتي وفواتيري" className="mt-2 flex items-center gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent"><ClipboardList className="h-4 w-4 shrink-0" />{!compact && "وحداتي وفواتيري"}</NavLink>}
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {user ? <div className={cn("flex items-center gap-2", compact && "flex-col")}>
            {!compact && <><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground"><User className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">{title.replace("لوحة ", "")}</p><p className="mt-1 truncate text-[11px] text-muted-foreground" dir="ltr" title={user.email}>{user.email}</p></div></>}
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="تسجيل الخروج" className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LogOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="left">تسجيل الخروج</TooltipContent></Tooltip>
          </div> : <NavLink to="/auth" className="flex items-center justify-center gap-2 rounded-md bg-sidebar-primary p-2 text-sm text-sidebar-primary-foreground" aria-label="تسجيل الدخول"><LogIn className="h-4 w-4" />{!compact && "تسجيل الدخول"}</NavLink>}
        </div>
      </aside>
    </TooltipProvider>
  );
};
