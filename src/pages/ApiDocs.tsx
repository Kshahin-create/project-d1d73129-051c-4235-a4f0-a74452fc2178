import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Code2,
  Copy,
  Download,
  Shield,
  Globe,
  AlertTriangle,
  KeyRound,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/api`;

// ---------- Types ----------
type Lang = "curl" | "python" | "js" | "dart" | "php";

interface Param {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
  example?: string;
}

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  desc: string;
  scope: "read" | "write" | "admin";
  pathParams?: Param[];
  queryParams?: Param[];
  bodyParams?: Param[];
  body?: object;
  response: object;
  notes?: string[];
}

// ---------- Endpoints (rich metadata) ----------
const endpoints: Endpoint[] = [
  {
    id: "list-buildings",
    method: "GET",
    path: "/buildings",
    title: "قائمة المباني",
    desc: "يرجع كل المباني مع إحصائيات الإشغال (عدد الوحدات، المؤجّرة، المحجوزة، المتاحة، الإيراد المتوقع).",
    scope: "read",
    response: {
      data: [
        {
          number: 1,
          type: "محلات قطع غيار السيارات وبناشر",
          total_units: 24,
          rented_units: 12,
          reserved_units: 3,
          available_units: 9,
          expected_annual_revenue: 1440000,
        },
      ],
      count: 13,
    },
  },
  {
    id: "get-building",
    method: "GET",
    path: "/buildings/:number",
    title: "تفاصيل مبنى",
    desc: "تفاصيل مبنى محدد مع كل وحداته الكاملة.",
    scope: "read",
    pathParams: [
      {
        name: "number",
        type: "integer",
        required: true,
        desc: "رقم المبنى",
        example: "1",
      },
    ],
    response: {
      data: {
        number: 1,
        type: "محلات قطع غيار السيارات وبناشر",
        expected_annual_revenue: 1440000,
        units: [
          {
            id: "uuid",
            building_number: 1,
            unit_number: 101,
            unit_type: "ركنية",
            area: 50,
            activity: "قطع غيار",
            price: 60000,
            status: "available",
          },
        ],
      },
    },
  },
  {
    id: "list-units",
    method: "GET",
    path: "/units",
    title: "قائمة الوحدات (مع فلاتر)",
    desc: "يرجع كل الوحدات. يمكن تصفيتها بأكثر من فلتر في نفس الوقت.",
    scope: "read",
    queryParams: [
      {
        name: "status",
        type: "string",
        desc: "حالة الوحدة. القيم المسموحة: `available`, `rented`, `reserved`",
        example: "available",
      },
      {
        name: "building_number",
        type: "integer",
        desc: "رقم المبنى",
        example: "1",
      },
      {
        name: "activity",
        type: "string",
        desc: "نوع النشاط. بحث جزئي (يحتوي على).",
        example: "صيانة",
      },
    ],
    response: {
      data: [
        {
          id: "uuid",
          building_number: 1,
          unit_number: 101,
          unit_type: "ركنية",
          area: 50,
          activity: "قطع غيار",
          price: 60000,
          status: "available",
        },
      ],
      count: 312,
    },
    notes: [
      "الحد الأقصى للنتائج 2000 وحدة في الطلب الواحد.",
      "النتائج مرتبة حسب رقم المبنى ثم رقم الوحدة.",
    ],
  },
  {
    id: "get-unit",
    method: "GET",
    path: "/units/:id",
    title: "تفاصيل وحدة",
    desc: "تفاصيل وحدة بالـ UUID + بيانات المستأجر إن وجد.",
    scope: "read",
    pathParams: [
      {
        name: "id",
        type: "uuid",
        required: true,
        desc: "معرف الوحدة (UUID)",
        example: "550e8400-e29b-41d4-a716-446655440000",
      },
    ],
    response: {
      data: {
        id: "uuid",
        building_number: 1,
        unit_number: 101,
        unit_type: "ركنية",
        area: 50,
        activity: "قطع غيار",
        price: 60000,
        status: "rented",
        tenant: {
          id: "uuid",
          tenant_name: "أحمد محمد",
          business_name: "ورشة النخبة",
          phone: "+966500000000",
          activity_type: "قطع غيار",
          start_date: "2026-01-01",
        },
      },
    },
  },
  {
    id: "create-booking",
    method: "POST",
    path: "/bookings",
    title: "إنشاء طلب حجز",
    desc: "نفس استمارة الموقع. يبعث الطلب لـ n8n webhook ويرجع تأكيد فوري.",
    scope: "read",
    bodyParams: [
      {
        name: "customer.fullName",
        type: "string",
        required: true,
        desc: "اسم العميل الكامل",
      },
      {
        name: "customer.phone",
        type: "string",
        required: true,
        desc: "رقم الجوال (يفضل بصيغة دولية +9665xxx)",
      },
      { name: "customer.email", type: "string", desc: "البريد الإلكتروني" },
      { name: "customer.business", type: "string", desc: "اسم النشاط" },
      { name: "customer.notes", type: "string", desc: "ملاحظات إضافية" },
      {
        name: "units",
        type: "array",
        required: true,
        desc: "مصفوفة من الوحدات المراد حجزها (اسحبها من /units)",
      },
      { name: "message", type: "string", desc: "رسالة واتساب اختيارية" },
    ],
    body: {
      customer: {
        fullName: "أحمد محمد",
        phone: "+966500000000",
        email: "ahmad@example.com",
        business: "ورشة النخبة",
        notes: "أحتاج وحدتين متجاورتين",
      },
      units: [
        {
          buildingNumber: 1,
          buildingType: "محلات قطع غيار",
          unitNumber: 101,
          unitType: "ركنية",
          area: 50,
          activity: "قطع غيار",
          price: 60000,
        },
      ],
      message: "السلام عليكم، أرغب في حجز الوحدات التالية...",
    },
    response: {
      success: true,
      booking_id: "uuid",
    },
  },
  {
    id: "list-tenants",
    method: "GET",
    path: "/tenants",
    title: "قائمة المستأجرين",
    desc: "كل المستأجرين مع رقم المبنى والوحدة. يدعم البحث بالاسم.",
    scope: "write",
    queryParams: [
      {
        name: "search",
        type: "string",
        desc: "بحث جزئي في اسم المستأجر",
        example: "أحمد",
      },
    ],
    response: {
      data: [
        {
          id: "uuid",
          unit_id: "uuid",
          tenant_name: "أحمد محمد",
          business_name: "ورشة النخبة",
          phone: "+966500000000",
          activity_type: "قطع غيار",
          start_date: "2026-01-01",
          units: { building_number: 1, unit_number: 101 },
        },
      ],
      count: 87,
    },
  },
  {
    id: "create-tenant",
    method: "POST",
    path: "/tenants",
    title: "إضافة مستأجر",
    desc: "ينشئ مستأجر جديد لوحدة ويحوّل حالة الوحدة تلقائياً إلى `rented`.",
    scope: "write",
    bodyParams: [
      {
        name: "unit_id",
        type: "uuid",
        required: true,
        desc: "معرف الوحدة",
      },
      {
        name: "tenant_name",
        type: "string",
        required: true,
        desc: "اسم المستأجر",
      },
      { name: "business_name", type: "string", desc: "اسم النشاط التجاري" },
      { name: "phone", type: "string", desc: "رقم الجوال" },
      { name: "activity_type", type: "string", desc: "نوع النشاط" },
      {
        name: "start_date",
        type: "date",
        desc: "تاريخ بداية العقد بصيغة YYYY-MM-DD",
      },
      { name: "notes", type: "string", desc: "ملاحظات" },
    ],
    body: {
      unit_id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_name: "أحمد محمد",
      business_name: "ورشة النخبة",
      phone: "+966500000000",
      activity_type: "قطع غيار",
      start_date: "2026-01-01",
    },
    response: {
      data: { id: "uuid", tenant_name: "أحمد محمد" },
    },
  },
  {
    id: "update-tenant",
    method: "PATCH",
    path: "/tenants/:id",
    title: "تعديل مستأجر",
    desc: "يحدّث الحقول المُرسلة فقط (partial update).",
    scope: "write",
    pathParams: [
      { name: "id", type: "uuid", required: true, desc: "معرف المستأجر" },
    ],
    body: { phone: "+966511111111", notes: "تم تحديث الرقم" },
    response: { data: { id: "uuid", phone: "+966511111111" } },
  },
  {
    id: "delete-tenant",
    method: "DELETE",
    path: "/tenants/:id",
    title: "حذف مستأجر",
    desc: "يحذف المستأجر ويرجّع حالة الوحدة لـ `available`. يتطلب صلاحية `admin`.",
    scope: "admin",
    pathParams: [
      { name: "id", type: "uuid", required: true, desc: "معرف المستأجر" },
    ],
    response: { success: true },
  },
  {
    id: "stats",
    method: "GET",
    path: "/stats",
    title: "الإحصائيات العامة",
    desc: "ملخص شامل للإيرادات والإشغال (مفيد للداشبورد).",
    scope: "read",
    response: {
      data: {
        buildings_count: 13,
        units: { total: 312, rented: 187, reserved: 12, available: 113 },
        occupancy_rate: 59.94,
        revenue: {
          actual_annual: 11220000,
          potential_annual: 18720000,
          currency: "SAR",
          vat_note: "السعر غير شامل ضريبة القيمة المضافة 15%",
        },
      },
    },
  },
];

// ---------- Code generators per language ----------
function buildUrl(e: Endpoint): string {
  let p = e.path
    .replace(":number", "1")
    .replace(":id", "550e8400-e29b-41d4-a716-446655440000");
  if (e.queryParams && e.queryParams.length > 0 && e.method === "GET") {
    const qs = e.queryParams
      .filter((q) => q.example)
      .map((q) => `${q.name}=${encodeURIComponent(q.example!)}`)
      .join("&");
    if (qs) p += `?${qs}`;
  }
  return `${BASE_URL}${p}`;
}

function genCurl(e: Endpoint): string {
  const url = buildUrl(e);
  const headers = [`-H "X-API-Key: nkb_live_xxx"`];
  if (e.body) headers.push(`-H "Content-Type: application/json"`);
  const method = e.method === "GET" ? "" : `-X ${e.method} `;
  const body = e.body ? ` \\\n  -d '${JSON.stringify(e.body)}'` : "";
  return `curl ${method}${headers.join(" ")} \\\n  "${url}"${body}`;
}

function genPython(e: Endpoint): string {
  const url = buildUrl(e);
  const hasBody = !!e.body;
  const lines = [
    `import requests`,
    ``,
    `API_KEY = "nkb_live_xxx"`,
    `headers = {"X-API-Key": API_KEY}`,
  ];
  if (hasBody) {
    lines.push(``, `payload = ${JSON.stringify(e.body, null, 4)}`);
  }
  lines.push(``);
  if (e.method === "GET") {
    lines.push(`response = requests.get("${url}", headers=headers)`);
  } else if (e.method === "DELETE") {
    lines.push(`response = requests.delete("${url}", headers=headers)`);
  } else if (e.method === "PATCH") {
    lines.push(
      `response = requests.patch("${url}", headers=headers, json=payload)`,
    );
  } else {
    lines.push(
      `response = requests.post("${url}", headers=headers, json=payload)`,
    );
  }
  lines.push(`response.raise_for_status()`, `data = response.json()`, `print(data)`);
  return lines.join("\n");
}

function genJs(e: Endpoint): string {
  const url = buildUrl(e);
  const opts: string[] = [`  method: "${e.method}"`];
  const headers: string[] = [`"X-API-Key": "nkb_live_xxx"`];
  if (e.body) headers.push(`"Content-Type": "application/json"`);
  opts.push(`  headers: { ${headers.join(", ")} }`);
  if (e.body) opts.push(`  body: JSON.stringify(${JSON.stringify(e.body, null, 2)})`);
  return `const res = await fetch("${url}", {\n${opts.join(
    ",\n",
  )},\n});\nconst data = await res.json();\nconsole.log(data);`;
}

function genDart(e: Endpoint): string {
  const url = buildUrl(e);
  const lines = [
    `import 'dart:convert';`,
    `import 'package:http/http.dart' as http;`,
    ``,
    `const apiKey = "nkb_live_xxx";`,
    `final headers = {`,
    `  "X-API-Key": apiKey,`,
  ];
  if (e.body) lines.push(`  "Content-Type": "application/json",`);
  lines.push(`};`, ``);
  if (e.method === "GET") {
    lines.push(
      `final res = await http.get(Uri.parse("${url}"), headers: headers);`,
    );
  } else if (e.method === "DELETE") {
    lines.push(
      `final res = await http.delete(Uri.parse("${url}"), headers: headers);`,
    );
  } else {
    const fn = e.method === "PATCH" ? "patch" : "post";
    lines.push(
      `final body = jsonEncode(${JSON.stringify(e.body, null, 2)});`,
      `final res = await http.${fn}(Uri.parse("${url}"), headers: headers, body: body);`,
    );
  }
  lines.push(`final data = jsonDecode(res.body);`, `print(data);`);
  return lines.join("\n");
}

function genPhp(e: Endpoint): string {
  const url = buildUrl(e);
  const lines = [
    `<?php`,
    `$apiKey = "nkb_live_xxx";`,
    `$ch = curl_init("${url}");`,
    `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${e.method}");`,
  ];
  const headers = [`"X-API-Key: $apiKey"`];
  if (e.body) headers.push(`"Content-Type: application/json"`);
  lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [${headers.join(", ")}]);`);
  if (e.body) {
    lines.push(
      `$payload = ${JSON.stringify(e.body)};`,
      `curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));`,
    );
  }
  lines.push(
    `$response = curl_exec($ch);`,
    `curl_close($ch);`,
    `$data = json_decode($response, true);`,
    `print_r($data);`,
  );
  return lines.join("\n");
}

const generators: Record<Lang, (e: Endpoint) => string> = {
  curl: genCurl,
  python: genPython,
  js: genJs,
  dart: genDart,
  php: genPhp,
};

const langLabel: Record<Lang, string> = {
  curl: "cURL",
  python: "Python",
  js: "JavaScript",
  dart: "Dart / Flutter",
  php: "PHP",
};

// ---------- Component ----------
const ApiDocs = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [scopeTab, setScopeTab] = useState("all");
  const [lang, setLang] = useState<Lang>("curl");

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
            ...(e.body
              ? [{ key: "Content-Type", value: "application/json" }]
              : []),
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

  if (loading || !isAdmin) return null;

  const filtered = endpoints.filter(
    (e) => scopeTab === "all" || e.scope === scopeTab,
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
          أمثلة جاهزة بـ 5 لغات وPostman Collection للتحميل.
        </p>

        {/* ===== نظرة عامة ===== */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5" />
              العنوان الأساسي (Base URL)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-3 font-mono text-sm break-all">
              <span className="flex-1">{BASE_URL}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(BASE_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="font-semibold">صيغة البيانات:</span> JSON
                (UTF-8)
              </div>
              <div>
                <span className="font-semibold">CORS:</span> مفتوح لكل
                الـorigins
              </div>
              <div>
                <span className="font-semibold">Rate limit:</span> غير مفعّل
                حالياً
              </div>
              <div>
                <span className="font-semibold">العملة:</span> SAR — أسعار
                سنوية بدون VAT
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== المصادقة ===== */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              المصادقة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              كل طلب لازم يحتوي على واحد من الترويستين (Headers) دول:
            </p>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                1- مفتاح API (الموصى به للتطبيقات والأنظمة الخارجية):
              </div>
              <div className="rounded-lg bg-secondary p-3 font-mono text-xs">
                X-API-Key: nkb_live_xxxxxxxxxxxxxxxxxx
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                2- JWT (لمستخدمي الموقع المسجّلين):
              </div>
              <div className="rounded-lg bg-secondary p-3 font-mono text-xs">
                Authorization: Bearer &lt;supabase_jwt&gt;
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4" />
                الصلاحيات (Scopes)
              </div>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>
                  <Badge variant="outline">read</Badge> — قراءة مباني/وحدات/
                  إحصائيات + إنشاء حجوزات
                </li>
                <li>
                  <Badge variant="outline">write</Badge> — كل ما سبق + إدارة
                  المستأجرين (إضافة/تعديل/قائمة)
                </li>
                <li>
                  <Badge variant="outline">admin</Badge> — كل ما سبق + الحذف
                </li>
              </ul>
            </div>
            <p className="text-muted-foreground">
              المفاتيح تُولَّد من{" "}
              <a className="text-primary underline" href="/admin/api-keys">
                صفحة مفاتيح الـ API
              </a>
              . المفتاح يظهر مرة واحدة فقط عند الإنشاء — احفظه فوراً.
            </p>
            <Button onClick={downloadPostman} variant="default">
              <Download className="h-4 w-4" />
              تحميل Postman Collection
            </Button>
          </CardContent>
        </Card>

        {/* ===== الأخطاء ===== */}
        <Card className="mb-6 border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              كودات الأخطاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-start">الكود</th>
                  <th className="py-2 text-start">المعنى</th>
                  <th className="py-2 text-start">السبب الشائع</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["200", "نجاح", "تم بنجاح"],
                  ["201", "تم الإنشاء", "تم إنشاء مورد جديد"],
                  ["400", "Bad Request", "بيانات ناقصة أو صيغة JSON خاطئة"],
                  ["401", "Unauthorized", "مفتاح API ناقص أو غير صحيح"],
                  ["403", "Forbidden", "المفتاح ليس له الصلاحية المطلوبة"],
                  ["404", "Not Found", "المسار أو المورد غير موجود"],
                  ["500", "Server Error", "خطأ داخلي - راجع السجلات"],
                  ["502", "Bad Gateway", "فشل الاتصال بـ webhook خارجي"],
                ].map(([code, name, reason]) => (
                  <tr key={code} className="border-b border-border/50">
                    <td className="py-2 font-mono">{code}</td>
                    <td className="py-2">{name}</td>
                    <td className="py-2 text-muted-foreground">{reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4">
              <div className="mb-1 text-xs text-muted-foreground">
                صيغة الخطأ:
              </div>
              <pre className="rounded-lg bg-secondary p-3 text-xs">
                {`{ "error": "وصف الخطأ" }`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* ===== فلاتر التصفح ===== */}
        <Tabs value={scopeTab} onValueChange={setScopeTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="read">قراءة</TabsTrigger>
            <TabsTrigger value="write">كتابة</TabsTrigger>
            <TabsTrigger value="admin">أدمن</TabsTrigger>
          </TabsList>
          <TabsContent value={scopeTab} />
        </Tabs>

        {/* ===== Endpoints ===== */}
        <div className="space-y-6">
          {filtered.map((e) => (
            <Card key={e.id} id={e.id}>
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
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {e.title}
                  </span>
                  <Badge variant="outline" className="ms-auto">
                    {e.scope}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{e.desc}</p>

                {/* Path params */}
                {e.pathParams && e.pathParams.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">
                      Path Parameters:
                    </div>
                    <ParamsTable params={e.pathParams} />
                  </div>
                )}

                {/* Query params */}
                {e.queryParams && e.queryParams.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Filter className="h-3 w-3" />
                      Query Parameters (الفلاتر):
                    </div>
                    <ParamsTable params={e.queryParams} />
                  </div>
                )}

                {/* Body params */}
                {e.bodyParams && e.bodyParams.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">
                      Body (JSON):
                    </div>
                    <ParamsTable params={e.bodyParams} />
                  </div>
                )}

                {e.body && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">
                      مثال على الـ Body:
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                      {JSON.stringify(e.body, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Response */}
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    مثال على الاستجابة (Response):
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
                    {JSON.stringify(e.response, null, 2)}
                  </pre>
                </div>

                {/* Notes */}
                {e.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                    <div className="mb-1 font-semibold">ملاحظات:</div>
                    <ul className="list-inside list-disc space-y-1">
                      {e.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Code examples per language */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      مثال كود — اختر اللغة:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(generators) as Lang[]).map((l) => (
                        <Button
                          key={l}
                          size="sm"
                          variant={lang === l ? "default" : "outline"}
                          onClick={() => setLang(l)}
                          className="h-7 px-2 text-xs"
                        >
                          {langLabel[l]}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute end-2 top-2 z-10 h-7"
                      onClick={() => copy(generators[lang](e))}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <pre className="overflow-x-auto rounded-lg bg-secondary p-3 pe-12 text-xs">
                      {generators[lang](e)}
                    </pre>
                  </div>
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

const ParamsTable = ({ params }: { params: Param[] }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-xs">
      <thead className="bg-muted/40 text-muted-foreground">
        <tr>
          <th className="px-3 py-2 text-start">الاسم</th>
          <th className="px-3 py-2 text-start">النوع</th>
          <th className="px-3 py-2 text-start">إلزامي</th>
          <th className="px-3 py-2 text-start">الوصف</th>
          <th className="px-3 py-2 text-start">مثال</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.name} className="border-t border-border">
            <td className="px-3 py-2 font-mono">{p.name}</td>
            <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
            <td className="px-3 py-2">
              {p.required ? (
                <Badge variant="destructive" className="text-[10px]">
                  نعم
                </Badge>
              ) : (
                <span className="text-muted-foreground">لا</span>
              )}
            </td>
            <td className="px-3 py-2">{p.desc}</td>
            <td className="px-3 py-2 font-mono text-muted-foreground">
              {p.example ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ApiDocs;
