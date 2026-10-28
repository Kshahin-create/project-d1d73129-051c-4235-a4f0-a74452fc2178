import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { PageMetadata } from "@/components/PageMetadata";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import Index from "./pages/Index.tsx";
const Booking = lazy(() => import("./pages/Booking.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const AuthMobileCallback = lazy(() => import("./pages/AuthMobileCallback.tsx"));
const AuthMobileStart = lazy(() => import("./pages/AuthMobileStart.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.tsx"));
const AdminAudit = lazy(() => import("./pages/AdminAudit.tsx"));
const AdminAccessLog = lazy(() => import("./pages/AdminAccessLog.tsx"));
const AdminTenants = lazy(() => import("./pages/AdminTenants.tsx"));
const AdminBookings = lazy(() => import("./pages/AdminBookings.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const AdminApiKeys = lazy(() => import("./pages/AdminApiKeys.tsx"));
const AdminStats = lazy(() => import("./pages/AdminStats.tsx"));
const ApiDocs = lazy(() => import("./pages/ApiDocs.tsx"));
const Mcp = lazy(() => import("./pages/Mcp.tsx"));
const ControlDashboard = lazy(() => import("./pages/ControlDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const HowToBook = lazy(() => import("./pages/HowToBook.tsx"));
const AdminTenantAccounts = lazy(() => import("./pages/AdminTenantAccounts.tsx"));
const AdminPaidTenants = lazy(() => import("./pages/AdminPaidTenants.tsx"));
const AdminCollectionsReport = lazy(() => import("./pages/AdminCollectionsReport.tsx"));
const TenantPortal = lazy(() => import("./pages/TenantPortal.tsx"));
const TenantMagicLogin = lazy(() => import("./pages/TenantMagicLogin.tsx"));
const Invoice = lazy(() => import("./pages/Invoice.tsx"));
const TelegramSettings = lazy(() => import("./pages/TelegramSettings.tsx"));
const Install = lazy(() => import("./pages/Install.tsx"));
const AdminLeads = lazy(() => import("./pages/AdminLeads.tsx"));
const AdminInterested = lazy(() => import("./pages/AdminInterested.tsx"));
const AdminSheetsSync = lazy(() => import("./pages/AdminSheetsSync.tsx"));
const AdminBackup = lazy(() => import("./pages/AdminBackup.tsx"));
import { MaintenanceGate } from "./components/MaintenanceGate.tsx";

const queryClient = new QueryClient();

function PublicFloatingContact() {
  const { pathname } = useLocation();
  return pathname === '/dashboard' ? null : <FloatingWhatsApp />;
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
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/access-log" element={<AdminAccessLog />} />
          <Route path="/admin/tenants" element={<AdminTenants />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/telegram" element={<TelegramSettings />} />
          <Route path="/admin/api-keys" element={<AdminApiKeys />} />
          <Route path="/admin/stats" element={<AdminStats />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/mcp" element={<Mcp />} />
          <Route path="/control" element={<ControlDashboard />} />
          <Route path="/how-to-book" element={<HowToBook />} />
          <Route path="/admin/tenant-accounts" element={<AdminTenantAccounts />} />
          <Route path="/admin/paid-tenants" element={<AdminPaidTenants />} />
          <Route path="/admin/collections-report" element={<AdminCollectionsReport />} />
          <Route path="/tenant" element={<TenantPortal />} />
          <Route path="/tenant-login/:token" element={<TenantMagicLogin />} />
          <Route path="/invoice/:id" element={<Invoice />} />
          <Route path="/install" element={<Install />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
          <Route path="/admin/interested" element={<AdminInterested />} />
          <Route path="/admin/sheets-sync" element={<AdminSheetsSync />} />
          <Route path="/admin/backup" element={<AdminBackup />} />
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
