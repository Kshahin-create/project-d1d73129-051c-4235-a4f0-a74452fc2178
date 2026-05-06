import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { AdminSidebar } from "@/components/AdminSidebar";
import Index from "./pages/Index.tsx";
import Booking from "./pages/Booking.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import Auth from "./pages/Auth.tsx";
import AuthMobileCallback from "./pages/AuthMobileCallback.tsx";
import AuthMobileStart from "./pages/AuthMobileStart.tsx";
import Admin from "./pages/Admin.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminTenants from "./pages/AdminTenants.tsx";
import AdminBookings from "./pages/AdminBookings.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import AdminApiKeys from "./pages/AdminApiKeys.tsx";
import AdminStats from "./pages/AdminStats.tsx";
import ApiDocs from "./pages/ApiDocs.tsx";
import ControlDashboard from "./pages/ControlDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/admin/tenants" element={<AdminTenants />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/api-keys" element={<AdminApiKeys />} />
          <Route path="/admin/stats" element={<AdminStats />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/control" element={<ControlDashboard />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingWhatsApp />
        <AdminSidebar />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
