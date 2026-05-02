import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Activity,
  Mail,
  Users,
  Building2,
  CalendarRange,
  KeyRound,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Server,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StatsResponse {
  generated_at: string;
  range_days: number;
  server: { status: string; project_ref: string };
  signins: { total: number; series: { ts: string; count: number }[]; source: string };
  emails: {
    total: number;
    sent: number;
    failed: number;
    suppressed: number;
    pending: number;
    series: { ts: string; count: number }[];
    topTemplates: { name: string; count: number }[];
  };
  bookings: {
    total: number;
    totalRevenue: number;
    totalUnits: number;
    series: { ts: string; count: number }[];
  };
  users: { total: number; roles: Record<string, number> };
  units: {
    total: number;
    rented: number;
    reserved: number;
    available: number;
    occupancy_rate: number;
    actualRevenue: number;
    potentialRevenue: number;
  };
  api_keys: { total: number; active: number; usedLast24h: number };
}

const RANGES = [
  { v: 1, l: "آخر 24 ساعة" },
  { v: 7, l: "آخر 7 أيام" },
  { v: 30, l: "آخر 30 يوم" },
  { v: 90, l: "آخر 90 يوم" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-primary bg-primary/10",
    success: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40",
    warning: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40",
    danger: "text-destructive bg-destructive/10",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold tabular-nums">{value}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n) + " ر.س";

const AdminStats = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/");
  }, [loading, user, isAdmin, navigate]);

  const load = async (d: number) => {
    setFetching(true);
    const { data: res, error } = await supabase.functions.invoke("admin-stats", {
      method: "GET",
      body: undefined,
      headers: {},
      // pass days via query string
    });
    // supabase-js v2 doesn't support query params in invoke, so call again with URL
    setFetching(false);
    if (error) {
      // Fallback: direct fetch with auth header
      try {
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stats?days=${d}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "فشل التحميل");
        setData(j);
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    setData(res as StatsResponse);
  };

  // direct fetch with proper days param
  const loadWithDays = async (d: number) => {
    setFetching(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) throw new Error("غير مسجل دخول");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stats?days=${d}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فشل التحميل");
      setData(j);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadWithDays(days);
  }, [isAdmin, days]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">لوحة الإحصائيات العامة</h1>
              <p className="text-xs text-muted-foreground">
                نظرة شاملة على السيرفر، الدخول، الإيميلات، الحجوزات والوحدات
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.v}
                size="sm"
                variant={days === r.v ? "default" : "outline"}
                onClick={() => setDays(r.v)}
              >
                {r.l}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => loadWithDays(days)}
              disabled={fetching}
            >
              <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {!data ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              {fetching ? "جارٍ التحميل..." : "لا توجد بيانات"}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Server status */}
            <Card className="mb-6">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  <span className="font-medium">حالة السيرفر</span>
                </div>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="ml-1 h-3 w-3" />
                  {data.server.status === "healthy" ? "يعمل بشكل ممتاز" : data.server.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  آخر تحديث:{" "}
                  {new Date(data.generated_at).toLocaleString("ar-EG")}
                </span>
              </CardContent>
            </Card>

            {/* Top stat cards */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Users}
                label="إجمالي المستخدمين"
                value={fmt(data.users.total)}
                hint={`أدمن: ${data.users.roles.admin ?? 0} • كنترول: ${data.users.roles.control ?? 0}`}
              />
              <StatCard
                icon={TrendingUp}
                label={`عمليات دخول (${days} يوم)`}
                value={fmt(data.signins.total)}
                hint={data.signins.source === "auth_logs" ? "من سجلات المصادقة" : "تقدير من الحسابات الجديدة"}
              />
              <StatCard
                icon={Mail}
                label={`إيميلات مُرسلة (${days} يوم)`}
                value={fmt(data.emails.sent)}
                hint={`${data.emails.total} محاولة • فشل: ${data.emails.failed}`}
                tone={data.emails.failed > 0 ? "warning" : "success"}
              />
              <StatCard
                icon={CalendarRange}
                label={`حجوزات (${days} يوم)`}
                value={fmt(data.bookings.total)}
                hint={`الإيراد: ${fmtMoney(data.bookings.totalRevenue)}`}
              />
            </div>

            {/* Units / Buildings stats */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Building2} label="إجمالي الوحدات" value={fmt(data.units.total)} />
              <StatCard
                icon={Building2}
                label="مؤجرة"
                value={fmt(data.units.rented)}
                hint={`نسبة الإشغال: ${data.units.occupancy_rate}%`}
                tone="success"
              />
              <StatCard
                icon={Building2}
                label="محجوزة / متاحة"
                value={`${fmt(data.units.reserved)} / ${fmt(data.units.available)}`}
              />
              <StatCard
                icon={KeyRound}
                label="مفاتيح API"
                value={`${fmt(data.api_keys.active)} / ${fmt(data.api_keys.total)}`}
                hint={`استُخدم خلال 24 ساعة: ${data.api_keys.usedLast24h}`}
              />
            </div>

            {/* Charts */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">عمليات الدخول اليومية</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.signins.series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ts" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الإيميلات اليومية</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.emails.series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ts" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">الحجوزات اليومية</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.bookings.series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ts" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">أكثر قوالب الإيميل استخداماً</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.emails.topTemplates.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      لا توجد بيانات
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.emails.topTemplates.map((t) => {
                        const max = data.emails.topTemplates[0].count || 1;
                        const pct = (t.count / max) * 100;
                        return (
                          <div key={t.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{t.name}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {fmt(t.count)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Email status breakdown */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">توزيع حالات الإيميل</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">مُرسل</div>
                    <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {fmt(data.emails.sent)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-3">
                    <div className="text-xs text-destructive">فشل</div>
                    <div className="text-2xl font-bold tabular-nums text-destructive">
                      {fmt(data.emails.failed)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                    <div className="text-xs text-amber-700 dark:text-amber-400">مقيّد</div>
                    <div className="text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-300">
                      {fmt(data.emails.suppressed)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">قيد الإرسال</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {fmt(data.emails.pending)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API hint */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الوصول عبر API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  يمكنك جلب نفس البيانات من خلال:
                </p>
                <code className="block break-all rounded-lg bg-secondary p-3 font-mono text-xs">
                  GET {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/stats/overview?days={days}
                </code>
                <p className="text-xs text-muted-foreground">
                  أرسل الهيدر <code className="rounded bg-secondary px-1">X-API-Key: nkb_...</code>{" "}
                  من{" "}
                  <a className="text-primary underline" href="/admin/api-keys">
                    صفحة مفاتيح API
                  </a>
                  .
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminStats;
