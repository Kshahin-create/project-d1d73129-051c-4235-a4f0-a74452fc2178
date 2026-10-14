import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { ExecutiveSummary } from '@/components/dashboard/ExecutiveSummary';
import { DashboardDetails, type DashboardDetailView } from '@/components/dashboard/DashboardDetails';
import { EMPTY_FILTERS, type DashboardFilters, type DateRange } from '@/lib/dashboardMetrics';

export default function Dashboard() {
  const auth = useAuth();
  const authorized = !auth.loading && !!auth.user && (auth.isAdmin || auth.isManager);
  const data = useDashboardData(authorized, auth.user?.id);
  const [detail, setDetail] = useState<{ view: DashboardDetailView; filters: DashboardFilters; range: DateRange; recordStatus: string } | null>(null);
  useEffect(() => { document.title = 'ملخص المشروع | المدينة الصناعية بشمال مكة'; }, []);
  const openDetails = (view: DashboardDetailView, filters = EMPTY_FILTERS, range: DateRange = { from: '', to: '' }, recordStatus = 'all') => {
    setDetail({ view, filters, range, recordStatus });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (auth.loading) return <div className="dashboard-workspace min-h-screen p-10" dir="rtl"><p role="status" className="text-muted-foreground">جارٍ تحميل الملخص…</p></div>;
  if (!authorized) return <div className="dashboard-workspace flex min-h-screen items-center justify-center p-6" dir="rtl"><div className="text-center"><Building2 className="mx-auto mb-4 h-10 w-10 text-primary" /><h1 className="text-xl">ملخص المشروع</h1><p className="my-3 text-sm text-muted-foreground">متاح للمشرفين والمديرين.</p><Button asChild><Link to={auth.user ? '/' : '/auth'}>{auth.user ? 'الرئيسية' : 'تسجيل الدخول'}</Link></Button></div></div>;
  return <>
    <div hidden={!!detail}><ExecutiveSummary data={data} onDetails={openDetails} /></div>
    {detail && <DashboardDetails data={data} userId={auth.user?.id} initialView={detail.view} initialFilters={detail.filters} initialRange={detail.range} initialRecordStatus={detail.recordStatus} onBack={() => { setDetail(null); window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-summary-count="all"]')?.closest('article')?.querySelector('button')?.focus()); }} />}
  </>;
}
