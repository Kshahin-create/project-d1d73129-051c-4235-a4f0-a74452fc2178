import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CHECK_META, findingHref, type DataQualityFinding } from "@/lib/dataQuality";

export default function DataQuality() {
  const auth = useAuth();
  const allowed = auth.isAdmin || auth.isManager;
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["data-quality-checks", auth.user?.id],
    enabled: allowed,
    queryFn: async () => {
      const r = await supabase.rpc("admin_data_quality_checks");
      if (r.error) throw r.error;
      return (r.data ?? []) as DataQualityFinding[];
    },
  });

  if (auth.loading) return null;
  if (!allowed) return <Navigate to="/auth" replace />;

  const findings = q.data ?? [];
  const grouped = new Map<string, DataQualityFinding[]>();
  for (const f of findings) {
    const list = grouped.get(f.check_code) ?? [];
    list.push(f);
    grouped.set(f.check_code, list);
  }

  const resolve = async (f: DataQualityFinding, resolution: "corrected" | "exception") => {
    let reason: string | null = null;
    if (resolution === "exception") {
      reason = window.prompt("سبب الاستثناء (5 أحرف على الأقل)");
      if (!reason || reason.trim().length < 5) return;
    }
    const key = `${f.check_code}:${f.entity_id}`;
    setBusy(key);
    const r = await supabase.rpc("resolve_data_quality_finding", {
      p_check_code: f.check_code,
      p_entity_table: f.entity_table,
      p_entity_id: f.entity_id,
      p_resolution: resolution,
      p_reason: reason,
    });
    setBusy(null);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success(resolution === "corrected" ? "سُجلت المعالجة" : "سُجل الاستثناء");
      void q.refetch();
    }
  };

  return (
    <>
      <Header />
      <main dir="rtl" className="container-tight space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">جودة البيانات</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              فحوصات يومية وعند الطلب · آخر فحص: {q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toLocaleString("ar-SA") : "—"}
            </p>
          </div>
          <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
            <RotateCcw className="h-4 w-4" /> فحص الآن
          </Button>
        </div>

        {q.isError && <p role="alert" className="text-destructive">تعذر تحميل الفحوصات: {(q.error as Error).message}</p>}
        {q.isPending && <p role="status">جارٍ تشغيل الفحوصات…</p>}

        {q.data && (
          <p className="text-sm text-muted-foreground">
            {findings.length === 0 ? "لا توجد ملاحظات مفتوحة — البيانات سليمة." : `${findings.length} ملاحظة مفتوحة`}
          </p>
        )}

        {[...grouped.entries()].map(([code, rows]) => {
          const meta = CHECK_META[code] ?? { title: code, description: "" };
          return (
            <section key={code} className="space-y-3 rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">{meta.title}</h2>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{rows.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((f) => {
                  const href = findingHref(f);
                  const key = `${f.check_code}:${f.entity_id}`;
                  return (
                    <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{f.detail}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {href && (
                          <Button asChild variant="outline" size="sm">
                            <Link to={href}>فتح السجل</Link>
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" disabled={busy === key} onClick={() => void resolve(f, "corrected")}>
                          تم التصحيح
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === key} onClick={() => void resolve(f, "exception")}>
                          استثناء مع سبب
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </>
  );
}
