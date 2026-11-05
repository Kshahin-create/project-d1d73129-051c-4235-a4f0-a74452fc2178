import { AdminServerList } from "@/components/admin/AdminServerList";
import { adminLists } from "@/lib/adminData";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Globe2, Search, Lock, ShieldAlert } from "lucide-react";

interface Row {
  id: string;
  created_at: string;
  user_id: string | null;
  phone: string | null;
  email: string | null;
  event: string;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  user_agent: string | null;
  path: string | null;
}

const EVENT_AR: Record<string, { label: string; cls: string }> = {
  sign_in: { label: "تسجيل دخول", cls: "bg-emerald-500/10 text-emerald-600" },
  login_failed: { label: "محاولة فاشلة", cls: "bg-destructive/10 text-destructive" },
  signup: { label: "إنشاء حساب", cls: "bg-primary/10 text-primary" },
};

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  });

const AdminAccessLog = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [page,setPage]=useState(0);
  const [total,setTotal]=useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      setFetching(false);
      return;
    }
    (async () => {
      let request=supabase.from("access_log").select("*",{count:"exact"});const term=search.trim().replace(/[,()%]/g,"");if(term)request=request.or(`phone.ilike.%${term}%,email.ilike.%${term}%,country.ilike.%${term}%,ip_address.ilike.%${term}%,city.ilike.%${term}%`);const {data,error,count}=await request.order("created_at",{ascending:false}).order("id").range(page*25,page*25+24);setTotal(count??0);
      if (error) toast.error("تعذر تحميل السجل");
      setRows((data ?? []) as Row[]);
      setFetching(false);
    })();
  }, [user, isAdmin, loading, navigate,page,search]);

  const filtered=rows;

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        جارٍ التحميل…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col" dir="rtl">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Lock className="h-8 w-8" />
          هذه الصفحة للمشرفين فقط
  <div className="mt-5 flex items-center gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>{total} سجل · صفحة {page+1}</span><Button variant="outline" disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>
      </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Globe2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">سجل الدخول والأجهزة</h1>
            <p className="text-sm text-muted-foreground">
              كل محاولة دخول أو إنشاء حساب مع عنوان الـ IP والموقع الجغرافي والجهاز
            </p>
          </div>
        </div>

<details className="my-4"><summary className="cursor-pointer text-primary">خيارات القائمة والتصدير</summary><AdminServerList spec={adminLists.access_log}/></details>
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {setSearch(e.target.value);setPage(0);}}
            placeholder="ابحث برقم الجوال أو الـ IP أو الدولة…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <ShieldAlert className="h-8 w-8" />
            لا توجد سجلات بعد — سيتم تسجيل أي دخول جديد تلقائياً
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="p-3 font-medium">التاريخ</th>
                  <th className="p-3 font-medium">الحدث</th>
                  <th className="p-3 font-medium">الحساب</th>
                  <th className="p-3 font-medium">IP</th>
                  <th className="p-3 font-medium">الموقع</th>
                  <th className="p-3 font-medium">المشغّل</th>
                  <th className="p-3 font-medium">الجهاز</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ev = EVENT_AR[r.event] ?? {
                    label: r.event,
                    cls: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-3 whitespace-nowrap" lang="en">
                        {fmt(r.created_at)}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-md px-2 py-1 text-xs ${ev.cls}`}>
                          {ev.label}
                        </span>
                      </td>
                      <td className="p-3" lang="en">
                        {r.phone || r.email || "—"}
                      </td>
                      <td className="p-3 font-mono text-xs" lang="en">
                        {r.ip_address || "—"}
                      </td>
                      <td className="p-3">
                        {[r.city, r.region, r.country].filter(Boolean).join("، ") || "—"}
                      </td>
                      <td className="p-3 text-xs">{r.isp || "—"}</td>
                      <td className="p-3 max-w-[260px] truncate text-xs text-muted-foreground">
                        {r.user_agent || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
<div className="mt-5 flex items-center gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>{total} سجل · صفحة {page+1}</span><Button variant="outline" disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminAccessLog;
