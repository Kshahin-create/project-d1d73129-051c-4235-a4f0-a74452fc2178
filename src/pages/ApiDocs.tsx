import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Copy, Download, Shield, Globe } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/api`;

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  desc: string;
  scope: "read" | "write" | "admin";
  body?: object;
  example: string;
};

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/buildings",
    desc: "قائمة كل المباني مع إحصائيات الإشغال",
    scope: "read",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/buildings"`,
  },
  {
    method: "GET",
    path: "/buildings/:number",
    desc: "تفاصيل مبنى محدد + كل وحداته",
    scope: "read",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/buildings/1"`,
  },
  {
    method: "GET",
    path: "/units",
    desc: "كل الوحدات. فلاتر اختيارية: ?status=available&building_number=1&activity=صيانة",
    scope: "read",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/units?status=available"`,
  },
  {
    method: "GET",
    path: "/units/:id",
    desc: "تفاصيل وحدة + بيانات المستأجر إن وجد (UUID)",
    scope: "read",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/units/<uuid>"`,
  },
  {
    method: "POST",
    path: "/bookings",
    desc: "إنشاء طلب حجز جديد (نفس استمارة الموقع)",
    scope: "read",
    body: {
      customer: {
        fullName: "اسم العميل",
        phone: "+9665xxxxxxxx",
        email: "x@y.com",
        business: "اسم النشاط",
        notes: "ملاحظات",
      },
      units: [
        {
          buildingNumber: 1,
          buildingType: "...",
          unitNumber: 101,
          unitType: "ركنية",
          area: 50,
          activity: "قطع غيار",
          price: 60000,
        },
      ],
      message: "اختياري",
    },
    example: `curl -X POST -H "X-API-Key: nkb_live_xxx" -H "Content-Type: application/json" \\
  -d '{"customer":{"fullName":"أحمد","phone":"+9665..."},"units":[{"buildingNumber":1,"unitNumber":101,"area":50,"price":60000}]}' \\
  "${BASE_URL}/bookings"`,
  },
  {
    method: "GET",
    path: "/tenants",
    desc: "قائمة المستأجرين. فلتر: ?search=اسم",
    scope: "write",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/tenants"`,
  },
  {
    method: "POST",
    path: "/tenants",
    desc: "إضافة مستأجر جديد لوحدة (يحوّل حالة الوحدة لـ rented)",
    scope: "write",
    body: {
      unit_id: "<unit uuid>",
      tenant_name: "اسم المستأجر",
      business_name: "اسم النشاط",
      phone: "+9665xxxxxxxx",
      activity_type: "قطع غيار",
      start_date: "2026-01-01",
      notes: "ملاحظات",
    },
    example: `curl -X POST -H "X-API-Key: nkb_live_xxx" -H "Content-Type: application/json" \\
  -d '{"unit_id":"<uuid>","tenant_name":"أحمد"}' "${BASE_URL}/tenants"`,
  },
  {
    method: "PATCH",
    path: "/tenants/:id",
    desc: "تعديل بيانات مستأجر",
    scope: "write",
    body: { tenant_name: "اسم جديد", phone: "+966..." },
    example: `curl -X PATCH -H "X-API-Key: nkb_live_xxx" -H "Content-Type: application/json" \\
  -d '{"phone":"+966..."}' "${BASE_URL}/tenants/<uuid>"`,
  },
  {
    method: "DELETE",
    path: "/tenants/:id",
    desc: "حذف مستأجر (يرجّع الوحدة لـ available). يتطلب صلاحية أدمن.",
    scope: "admin",
    example: `curl -X DELETE -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/tenants/<uuid>"`,
  },
  {
    method: "GET",
    path: "/stats",
    desc: "إحصائيات عامة: الإشغال، الإيرادات، عدد المباني",
    scope: "read",
    example: `curl -H "X-API-Key: nkb_live_xxx" "${BASE_URL}/stats"`,
  },
];

const ApiDocs = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const postmanCollection = useMemo(
    () => ({
      info: {
        name: "نخبة تسكين API",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      auth: {
        type: "apikey",
        apikey: [
          { key: "key", value: "X-API-Key" },
          { key: "value", value: "{{apiKey}}" },
          { key: "in", value: "header" },
        ],
      },
      variable: [
        { key: "baseUrl", value: BASE_URL },
        { key: "apiKey", value: "nkb_live_REPLACE_ME" },
      ],
      item: endpoints.map((e) => ({
        name: `${e.method} ${e.path}`,
        request: {
          method: e.method,
          header: [
            { key: "X-API-Key", value: "{{apiKey}}" },
            ...(e.body ? [{ key: "Content-Type", value: "application/json" }] : []),
          ],
          ...(e.body
            ? { body: { mode: "raw", raw: JSON.stringify(e.body, null, 2) } }
            : {}),
          url: {
            raw: `{{baseUrl}}${e.path}`,
            host: ["{{baseUrl}}"],
            path: e.path.split("/").filter(Boolean),
          },
        },
      })),
    }),
    [],
  );

  const downloadPostman = () => {
    const blob = new Blob([JSON.stringify(postmanCollection, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nokhba-taskeen-api.postman_collection.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const filtered = endpoints.filter(
    (e) => tab === "all" || e.scope === tab,
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-2 flex items-center gap-3">
          <Code2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">توثيق REST API</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          استهلك بيانات نخبة تسكين من تطبيق الموبايل أو أي نظام تاني عبر REST.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5" />
              العنوان الأساسي (Base URL)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3 font-mono text-sm break-all">
              <span className="flex-1">{BASE_URL}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(BASE_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              المصادقة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              كل طلب لازم يحتوي على واحد من الترويستين:
            </p>
            <div className="rounded-lg bg-secondary p-3 font-mono text-xs">
              X-API-Key: nkb_live_xxxxxxxxxxxxxxxxxx
            </div>
            <p className="text-muted-foreground">— أو —</p>
            <div className="rounded-lg bg-secondary p-3 font-mono text-xs">
              Authorization: Bearer &lt;supabase_jwt&gt;
            </div>
            <p className="text-muted-foreground">
              المفاتيح تُولَّد من{" "}
              <a className="text-primary underline" href="/admin/api-keys">
                صفحة مفاتيح الـ API
              </a>{" "}
              (للأدمن فقط).
            </p>
            <Button onClick={downloadPostman} variant="default">
              <Download className="h-4 w-4" />
              تحميل Postman Collection
            </Button>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="read">قراءة</TabsTrigger>
            <TabsTrigger value="write">كتابة</TabsTrigger>
            <TabsTrigger value="admin">أدمن</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>

        <div className="space-y-4">
          {filtered.map((e) => (
            <Card key={`${e.method}-${e.path}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <Badge
                    variant={
                      e.method === "GET"
                        ? "secondary"
                        : e.method === "DELETE"
                          ? "destructive"
                          : "default"
                    }
                  >
                    {e.method}
                  </Badge>
                  <code className="text-sm">{e.path}</code>
                  <Badge variant="outline" className="ms-auto">
                    {e.scope}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{e.desc}</p>
                {e.body && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Body (JSON):
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                      {JSON.stringify(e.body, null, 2)}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>مثال curl:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(e.example)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                    {e.example}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApiDocs;
