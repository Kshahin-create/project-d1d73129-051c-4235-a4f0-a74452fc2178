import { ArrowUpLeft, Building2, ChartNoAxesCombined, CalendarDays, Wallet, FileCheck2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardDetailView } from './DashboardDetails';

export function ReportDirectory({ onOpen }: { onOpen: (view: DashboardDetailView) => void }) {
  const reports = [
    { title:'مقارنة المباني', subtitle:'الحالات والقيم السنوية والتحصيل', view:'overview', icon:Building2 },
    { title:'التأجير والأنشطة', subtitle:'توزيع الوحدات ومقارنة أداء الأنشطة', view:'analytics', icon:ChartNoAxesCombined },
    { title:'إنجاز الفترة', subtitle:'تأكيدات التأجير والإلغاء والانتهاء المسجلة', view:'events', icon:CalendarDays },
    { title:'تقرير التحصيل', subtitle:'الدفعات المسجلة حسب الوحدة والفترة', view:'financial', icon:Wallet },
    { title:'الفواتير والاستحقاقات', subtitle:'الفواتير المسجلة والمستحق والمتأخر', view:'invoices', icon:FileCheck2 },
    { title:'مراجعة البيانات', subtitle:'البيانات الناقصة والحالات التي تحتاج تحققاً', view:'review', icon:ClipboardCheck },
  ] as const;
  return <section aria-label="دليل التقارير" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{reports.map(r => <article key={r.view} className="rounded-lg border border-border bg-card p-5"><r.icon className="mb-5 h-6 w-6 text-primary"/><h2 className="text-base">{r.title}</h2><p className="mt-2 min-h-10 text-sm text-muted-foreground">{r.subtitle}</p><Button variant="link" className="mt-4 gap-2 px-0" onClick={() => onOpen(r.view)}>فتح التقرير<ArrowUpLeft className="h-4 w-4"/></Button></article>)}</section>;
}