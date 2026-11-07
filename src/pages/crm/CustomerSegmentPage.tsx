import { Navigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { PartyDirectory, type Segment } from "@/components/crm/PartyDirectory";

const SEGMENTS: Record<string, Segment> = { "/admin/parties": "all", "/admin/leads": "target", "/admin/interested": "interested" };

export default function CustomerSegmentPage() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const segment = SEGMENTS[pathname.replace(/\/$/, "")] ?? "all";
  if (auth.loading) return null;
  if (!auth.user || !auth.can("customers.names", "view")) return <Navigate to="/auth" replace />;
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <PartyDirectory key={segment} segment={segment} />
      </main>
    </div>
  );
}
