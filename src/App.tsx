import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { PageMetadata } from "@/components/PageMetadata";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { legacyAdminRoutes, redirectedAdminHref } from "@/lib/adminNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import Index from "./pages/Index.tsx";
const TaskSettings = lazy(()=>import('./pages/admin/TaskSettings'));
const TeamFollowupViews = lazy(()=>import('./pages/admin/TeamFollowupViews'));
const DataQuality = lazy(()=>import('./pages/admin/DataQuality'));
const SystemAuditLog = lazy(()=>import('./pages/admin/SystemAuditLog'));
const AdminHelp = lazy(()=>import('./pages/admin/AdminHelp'));
const MyTasks = lazy(()=>import('./pages/MyTasks'));
const Booking = lazy(() => import("./pages/Booking.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const AuthMobileCallback = lazy(() => import("./pages/AuthMobileCallback.tsx"));
const AuthMobileStart = lazy(() => import("./pages/AuthMobileStart.tsx"));
const MetricsHome = lazy(() => import("./pages/MetricsDashboard.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.tsx"));
const PermissionsGuide = lazy(() => import('./pages/PermissionsGuide.tsx'));
const AdminAudit = lazy(() => import("./pages/AdminAudit.tsx"));
const AdminAccessLog = lazy(() => import("./pages/AdminAccessLog.tsx"));
const AdminTenants = lazy(() => import("./pages/AdminTenants.tsx"));
const AdminBookings = lazy(() => import("./pages/AdminBookings.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const AdminApiKeys = lazy(() => import("./pages/AdminApiKeys.tsx"));
const AdminCampaigns = lazy(() => import("./pages/AdminCampaigns.tsx"));
const AdminStats = lazy(() => import("./pages/AdminStats.tsx"));
const ApiDocs = lazy(() => import("./pages/ApiDocs.tsx"));
const Mcp = lazy(() => import("./pages/Mcp.tsx"));
const ControlDashboard = lazy(() => import("./pages/ControlDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const HowToBook = lazy(() => import("./pages/HowToBook.tsx"));
const AdminTenantAccounts = lazy(() => import("./pages/AdminTenantAccounts.tsx"));
const AdminPaidTenants = lazy(() => import("./pages/AdminPaidTenants.tsx"));
const AdminCollectionsReport = lazy(() => import("./pages/AdminCollectionsReport.tsx"));
const FinanceWorkspace = lazy(() => import("./pages/FinanceWorkspace.tsx"));
const TenantPortal = lazy(() => import("./pages/TenantPortal.tsx"));
const TenantMagicLogin = lazy(() => import("./pages/TenantMagicLogin.tsx"));
const Invoice = lazy(() => import("./pages/Invoice.tsx"));
const TelegramSettings = lazy(() => import("./pages/TelegramSettings.tsx"));
const Install = lazy(() => import("./pages/Install.tsx"));
const AdminLeads = lazy(() => import("./pages/AdminLeads.tsx"));
const AdminInterested = lazy(() => import("./pages/AdminInterested.tsx"));
const AdminSheetsSync = lazy(() => import("./pages/AdminSheetsSync.tsx"));
const AdminActivities = lazy(() => import("./pages/AdminActivities.tsx"));
const AdminUnitImport = lazy(() => import("./pages/AdminUnitImport.tsx"));
const AdminUnitsIncomplete = lazy(() => import("./pages/AdminUnitsIncomplete.tsx"));
const AdminUnitStatusReview = lazy(() => import("./pages/AdminUnitStatusReview.tsx"));
const LeasingHolds = lazy(() => import("./pages/LeasingHolds.tsx"));
const CrmPipeline = lazy(() => import("./pages/crm/CrmPipeline.tsx"));
const CrmParty = lazy(() => import("./pages/crm/CrmParty.tsx"));
const CrmOpportunity = lazy(() => import("./pages/crm/CrmOpportunity.tsx"));
const CrmUnassigned = lazy(() => import("./pages/crm/CrmUnassigned.tsx"));
const CrmTeamPerformance = lazy(() => import("./pages/crm/CrmTeamPerformance.tsx"));
const CrmImportTargets = lazy(() => import("./pages/crm/CrmImportTargets.tsx"));
const AdminBackup = lazy(() => import("./pages/AdminBackup.tsx"));
const AdminBookingControl = lazy(() => import("./pages/AdminBookingControl.tsx"));
const AdminRecord = lazy(() => import("./pages/AdminRecord.tsx"));
const AdminWorkspace = lazy(() => import("./pages/AdminWorkspace.tsx"));
import { MaintenanceGate } from "./components/MaintenanceGate.tsx";

const queryClient = new QueryClient();
function LegacyAdminRedirect() {
  const location = useLocation();
  return <Navigate replace to={redirectedAdminHref(location.pathname, location.search, location.hash) ?? "/admin"} />;
}
function AdminOnly({children}: {children: React.ReactNode}) {
  const auth = useAuth();
  if (auth.loading) return null;
  return auth.isAdmin ? <>{children}</> : <Navigate to="/auth" replace />;
}

function PublicFloatingContact() {
  const { pathname } = useLocation();
  return pathname === "/dashboard" || pathname.startsWith("/admin") || pathname.startsWith("/crm") || pathname === "/control" ? null : <FloatingWhatsApp />;
}

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PageMetadata />
        <MaintenanceGate>
        <Suspense fallback={<div className="min-h-screen grid place-items-center bg-background text-muted-foreground" role="status">جارٍ تحميل الصفحة…</div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/mobile-callback" element={<AuthMobileCallback />} />
          <Route path="/auth/mobile/start" element={<AuthMobileStart />} />
          <Route path="/admin/tasks" element={<MyTasks/>}/>
          <Route path="/admin/settings/tasks" element={<TaskSettings/>}/>
          <Route path="/admin/followup" element={<TeamFollowupViews/>}/>
          <Route path="/admin/data-quality" element={<DataQuality/>}/>
          <Route path="/admin/system-log" element={<AdminOnly><SystemAuditLog/></AdminOnly>}/>
          <Route path="/admin/help" element={<AdminOnly><AdminHelp/></AdminOnly>}/>
          <Route path="/admin" element={<MetricsHome />} />
          <Route path="/admin/maintenance" element={<ControlDashboard />} />
          <Route path="/admin/legacy-units" element={<Admin />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/settings/permissions" element={<AdminOnly><AdminUsers /></AdminOnly>} />
          <Route path="/admin/permissions-guide" element={<PermissionsGuide />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/access-log" element={<AdminAccessLog />} />
          <Route path="/admin/tenants" element={<AdminTenants />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/dashboard" element={<MetricsHome />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/telegram" element={<TelegramSettings />} />
          {Object.keys(legacyAdminRoutes).map(path => <Route key={path} path={path} element={<LegacyAdminRedirect />} />)}
          <Route path="/admin/settings/developers/api-keys" element={<AdminOnly><AdminApiKeys /></AdminOnly>} />
          <Route path="/admin/campaigns" element={<AdminCampaigns />} />
          <Route path="/admin/settings/developers/stats" element={<AdminOnly><AdminStats /></AdminOnly>} />
          <Route path="/admin/settings/developers/api-docs" element={<AdminOnly><ApiDocs /></AdminOnly>} />
          <Route path="/admin/settings/developers/mcp" element={<AdminOnly><Mcp /></AdminOnly>} />
          <Route path="/control" element={<MetricsHome />} />
          <Route path="/how-to-book" element={<HowToBook />} />
          <Route path="/admin/tenant-accounts" element={<AdminTenantAccounts />} />
          <Route path="/admin/paid-tenants" element={<AdminPaidTenants />} />
          <Route path="/admin/collections-report" element={<AdminCollectionsReport />} />
          <Route path="/admin/contracts" element={<FinanceWorkspace />} />
          <Route path="/admin/settings/payment-plans" element={<FinanceWorkspace />} />
          <Route path="/admin/receipts" element={<FinanceWorkspace />} />
          <Route path="/admin/receipt-reconciliation" element={<FinanceWorkspace />} />
          <Route path="/admin/receipt-review" element={<FinanceWorkspace />} />
          <Route path="/tenant" element={<TenantPortal />} />
          <Route path="/tenant-login/:token" element={<TenantMagicLogin />} />
          <Route path="/invoice/:id" element={<Invoice />} />
          <Route path="/install" element={<Install />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
          <Route path="/admin/interested" element={<AdminInterested />} />
          <Route path="/admin/sheets-sync" element={<AdminSheetsSync />} />
          <Route path="/admin/settings/activities" element={<AdminActivities />} />
          <Route path="/admin/settings/unit-import" element={<AdminUnitImport />} />
          <Route path="/admin/units-incomplete" element={<AdminUnitsIncomplete />} />
          <Route path="/admin/unit-status-review" element={<AdminUnitStatusReview />} />
          <Route path="/leasing/holds" element={<LeasingHolds />} />
          <Route path="/crm/party/:id" element={<LegacyAdminRedirect />} />
          <Route path="/crm/opportunity/:id" element={<LegacyAdminRedirect />} />
          <Route path="/admin/opportunities" element={<CrmPipeline />} />
          <Route path="/admin/opportunities/:id" element={<CrmOpportunity />} />
          <Route path="/admin/opportunities/unassigned" element={<CrmUnassigned />} />
          <Route path="/admin/opportunities/team" element={<CrmTeamPerformance />} />
          <Route path="/admin/opportunities/import" element={<CrmImportTargets />} />
          {["units","parties","installments"].map(kind=><Route key={kind} path={`/admin/${kind}`} element={<AdminWorkspace />} />)}
          {["units","parties","contracts","receipts","bookings"].map(kind=><Route key={kind} path={`/admin/${kind}/:id`} element={<AdminRecord />} />)}
          <Route path="/admin/backup" element={<AdminBackup />} />
          <Route path="/admin/booking-control" element={<AdminBookingControl />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <PublicFloatingContact />
        <AdminSidebar />
        <ReadOnlyBanner />
        <InstallPrompt />
        </Suspense>
        </MaintenanceGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
