import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";

export default function AdminHelp() {
  const auth = useAuth();
  const backup = useQuery({
    queryKey: ["last-system-backup"],
    enabled: auth.isAdmin,
    queryFn: async () => {
      const r = await supabase
        .from("system_backups")
        .select("name,kind,size_bytes,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });

  if (auth.loading) return null;
  if (!auth.isAdmin) return <Navigate to="/auth" replace />;

  return (
    <>
      <Header />
      <main dir="rtl" className="container-tight space-y-8 py-8">
        <h1 className="text-2xl font-bold">المساعدة والنسخ الاحتياطي</h1>

        <section className="space-y-3 rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-bold">آخر نسخة احتياطية داخل النظام</h2>
          {backup.isPending && <p role="status">جارٍ التحميل…</p>}
          {backup.isError && <p role="alert" className="text-destructive">تعذر قراءة سجل النسخ</p>}
          {backup.data ? (
            <p className="text-sm">
              آخر نسخة: <strong>{new Date(backup.data.created_at).toLocaleString("ar-SA")}</strong>
              {backup.data.size_bytes ? ` · الحجم ${(Number(backup.data.size_bytes) / 1024 / 1024).toFixed(1)} ميجابايت` : ""}
            </p>
          ) : (
            !backup.isPending && <p className="text-sm text-muted-foreground">لا توجد نسخ مسجلة بعد.</p>
          )}
          <p className="text-xs text-muted-foreground">يعمل النسخ التلقائي داخل النظام كل 12 ساعة.</p>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-bold">النسخ الاحتياطي اليومي لقاعدة البيانات</h2>
          <p className="text-sm">
            المنصة تحتفظ بنسخة احتياطية تلقائية يومية لقاعدة البيانات (البنية والبيانات) لمدة تقارب 14 يومًا.
            لا تشمل هذه النسخ الملفات المرفوعة في التخزين.
          </p>
          <p className="text-sm text-muted-foreground">
            للتأكد من وقت آخر نسخة يومية: من لوحة المشروع افتح «المزيد» ثم «قاعدة البيانات» ثم «إدارة» ثم «النسخ الاحتياطي» —
            كل صف يعرض توقيت النسخة بالتوقيت العالمي UTC. هذه الصفحة هي المصدر الوحيد المؤكد لأوقات النسخ اليومية.
          </p>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-5">
          <h2 className="text-lg font-bold">خطوات الاستعادة من نسخة احتياطية</h2>
          <ol className="list-decimal space-y-2 pr-5 text-sm">
            <li>قبل الاستعادة، صدّر البيانات الحالية من «المزيد ← قاعدة البيانات ← إدارة ← الإعدادات ← تصدير بيانات المشروع» للحفاظ على أي تغييرات حديثة.</li>
            <li>افتح «المزيد ← قاعدة البيانات ← إدارة ← النسخ الاحتياطي».</li>
            <li>اختر أقرب نسخة سابقة للحظة المطلوبة واضغط «الاستعادة إلى هذه النسخة» ثم أكّد.</li>
            <li>تكون قاعدة البيانات غير متاحة لدقائق أثناء الاستعادة.</li>
          </ol>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-bold">تنبيهات مهمة قبل الاستعادة:</p>
            <ul className="mt-2 list-disc space-y-1 pr-5">
              <li>الاستعادة نهائية: أي بيانات أُنشئت أو عُدّلت بعد وقت النسخة تُفقد.</li>
              <li>بنية قاعدة البيانات ترجع مع البيانات، وقد يحتاج التطبيق تحديثًا ليطابقها.</li>
              <li>لا توجد استعادة للحظة محددة بين النسخ — أقرب نقطة هي أقرب نسخة يومية سابقة.</li>
              <li>ملفات التخزين (المستندات وإثباتات السداد) غير مشمولة وتُنزَّل separately من صفحة التخزين.</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
