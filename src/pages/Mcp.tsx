import { Link, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import {
  Bot,
  KeyRound,
  Plug,
  Sparkles,
  Terminal,
  Wrench,
  ShieldCheck,
} from "lucide-react";

const MCP_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

const TOOLS = [
  {
    name: "list_buildings",
    desc: "قائمة العمائر مع نوعها ورقمها والإيراد السنوي المتوقع.",
  },
  {
    name: "list_units",
    desc: "قائمة الوحدات مع تصفية اختيارية بالحالة أو رقم العمارة.",
  },
  {
    name: "get_unit",
    desc: "تفاصيل وحدة برقم العمارة ورقم الوحدة.",
  },
  {
    name: "search_units",
    desc: "بحث عن وحدات متاحة بحدّ أعلى للسعر و/أو حدّ أدنى للمساحة و/أو نوع.",
  },
  {
    name: "stats_overview",
    desc: "إحصائيات سريعة: عدد الوحدات حسب الحالة وعدد الحجوزات والإيراد المتوقع.",
  },
  {
    name: "list_bookings",
    desc: "آخر الحجوزات مع تصفية اختيارية بالحالة.",
  },
  {
    name: "get_booking",
    desc: "تفاصيل حجز معيّن مع الوحدات المرتبطة به.",
  },
];

const Mcp = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const claudeConfig = `{
  "mcpServers": {
    "mnicejar": {
      "url": "${MCP_URL}",
      "headers": {
        "X-API-Key": "nkb_xxx"
      }
    }
  }
}`;

  const curlExample = `curl -X POST "${MCP_URL}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "X-API-Key: nkb_xxx" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="container-tight py-12">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
              خادم MCP لمنصة نخبة تسكين
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              اربط مساعدك الذكي (Claude / ChatGPT / Cursor / أي عميل MCP) بمنصة
              نخبة تسكين، واستعلم عن العمائر والوحدات والحجوزات بأوامر طبيعية.
            </p>
          </div>
        </section>

        <section className="container-tight pb-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "استعلامات ذكية",
                body: "اسأل المساعد عن وحدات متاحة بسعر أو مساحة معينة فيستجيب فورًا.",
              },
              {
                icon: Plug,
                title: "متوافق مع كل عميل MCP",
                body: "يعمل مع Claude Desktop وCursor وأي تطبيق يدعم بروتوكول MCP.",
              },
              {
                icon: ShieldCheck,
                title: "آمن ومحمي",
                body: "كل طلب يتم التحقق منه بمفتاح API خاص بك ويمكن إبطاله في أي وقت.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-display font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container-tight py-8">
          <h2 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> الأدوات المتاحة
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="font-mono text-sm font-bold text-primary">
                  {t.name}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container-tight py-8">
          <h2 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> الخطوات
          </h2>
          <ol className="mt-4 space-y-4">
            <li className="rounded-xl border border-border bg-card p-4">
              <div className="font-bold">١. أنشئ مفتاح API</div>
              <p className="mt-1 text-sm text-muted-foreground">
                من{" "}
                <Link
                  to="/admin/api-keys"
                  className="text-primary underline underline-offset-2"
                >
                  لوحة مفاتيح API
                </Link>{" "}
                أنشئ مفتاحًا جديدًا بصلاحيات القراءة (read).
              </p>
            </li>
            <li className="rounded-xl border border-border bg-card p-4">
              <div className="font-bold">٢. عنوان الخادم (MCP URL)</div>
              <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {MCP_URL}
              </pre>
            </li>
            <li className="rounded-xl border border-border bg-card p-4">
              <div className="font-bold">٣. اربط العميل (مثال: Claude Desktop)</div>
              <p className="mt-1 text-sm text-muted-foreground">
                أضف الإعداد التالي في ملف{" "}
                <code className="rounded bg-muted px-1">claude_desktop_config.json</code>:
              </p>
              <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {claudeConfig}
              </pre>
            </li>
            <li className="rounded-xl border border-border bg-card p-4">
              <div className="font-bold flex items-center gap-2">
                <Terminal className="h-4 w-4" /> ٤. اختبار سريع عبر cURL
              </div>
              <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {curlExample}
              </pre>
            </li>
          </ol>
        </section>

        <section className="container-tight py-8">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <h3 className="font-display text-xl font-extrabold">
              جاهز للبدء؟
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              أنشئ مفتاح API وابدأ بربط مساعدك الذكي خلال دقيقة.
            </p>
            <Link
              to="/admin/api-keys"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-primary px-6 py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated"
            >
              إنشاء مفتاح API
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Mcp;
