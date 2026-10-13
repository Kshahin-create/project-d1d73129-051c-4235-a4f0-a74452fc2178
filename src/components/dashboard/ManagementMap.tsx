import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ZoomIn, ArrowUpRight, MapPin } from 'lucide-react';
import masterPlan from '@/assets/master-plan.png';
import { getPlanLayout } from '@/data/buildingPlans';
import { statusClass, statusLabel, type DashboardUnit } from '@/lib/dashboardMetrics';

const plans = import.meta.glob('/src/assets/plans/building-*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function ManagementMap({ units, building, onBuilding, onUnit }: { units: DashboardUnit[]; building: string; onBuilding: (v: string) => void; onUnit: (u: DashboardUnit) => void }) {
  const [zoom, setZoom] = useState(false);
  const numbers = [...new Set(units.map(u => u.building_number))].sort((a, b) => a - b);
  const layout = building !== 'all' ? getPlanLayout(Number(building)) : undefined;
  const image = plans[`/src/assets/plans/building-${building}.svg`];
  const byNumber = new Map(units.map(u => [u.unit_number, u]));
  const mappedNumbers = new Set(layout?.units.map(a => a.unitNumber) ?? []);
  const renderPlan = () => <div className="relative mx-auto w-full max-w-3xl" style={layout ? { aspectRatio: layout.aspectRatio } : undefined}>
    <img src={image} alt={`المخطط الأصلي للمبنى ${building}`} className="block h-full w-full object-contain" />
    {layout?.units.map(area => { const unit = byNumber.get(area.unitNumber); return unit ? <Button key={area.unitNumber} onClick={() => onUnit(unit)} aria-label={`وحدة ${unit.unit_number}، ${statusLabel(unit.status)}`} title={`وحدة ${unit.unit_number} · ${statusLabel(unit.status)}`} className={`absolute min-h-0 rounded-none border p-0 text-[10px] sm:text-xs ${statusClass(unit.status)}`} variant="ghost" style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.w}%`, height: `${area.h}%` }}><span className="num">{unit.unit_number}</span></Button> : null; })}
  </div>;
  return <section aria-labelledby="project-map-title" className="min-w-0">
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="project-map-title" className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" /> مخطط المشروع</h2><p className="mt-1 text-xs text-muted-foreground">{building === 'all' ? 'المخطط العام الأصلي · ألوان المخطط ليست حالات التأجير الحالية' : `مبنى ${building} · الحالة الحالية للوحدات المطابقة`}</p></div><Button size="icon" variant="outline" aria-label="تكبير المخطط" title="تكبير المخطط" onClick={() => setZoom(true)}><ZoomIn /></Button></div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
      <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-lg border bg-card p-3">
        {building !== 'all' && image ? renderPlan() : <img src={masterPlan} alt="المخطط العام الأصلي للمدينة الصناعية بشمال مكة" className="h-[430px] max-w-full object-contain" />}
      </div>
      <div className="min-w-0"><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>المباني المطابقة</span><span className="num">{numbers.length}</span></div><div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <Button variant={building === 'all' ? 'default' : 'outline'} onClick={() => onBuilding('all')} className="justify-between">المخطط العام <ArrowUpRight /></Button>
        {numbers.map(n => <Button key={n} variant={building === String(n) ? 'default' : 'outline'} onClick={() => onBuilding(String(n))} className="justify-between"><span>مبنى <span className="num">{n}</span></span><span className="num text-xs">{units.filter(u => u.building_number === n).length}</span></Button>)}
      </div></div>
    </div>
    <div className="mt-4"><h3 className="mb-2 text-xs text-muted-foreground">قائمة الوحدات الحالية · منفصلة عن مواقع المخطط العام</h3><div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 xl:grid-cols-12">{units.map(u => <Button key={u.id} size="sm" variant="ghost" onClick={() => onUnit(u)} className={`h-11 border ${statusClass(u.status)}`} title={`مبنى ${u.building_number} · ${statusLabel(u.status)}`} aria-label={`تفاصيل مبنى ${u.building_number} وحدة ${u.unit_number}`}><span className="num text-xs">{u.unit_number}</span></Button>)}</div>{!units.length && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد وحدات مطابقة</p>}{layout && units.some(u => !mappedNumbers.has(u.unit_number)) && <p className="mt-2 text-xs text-muted-foreground">الوحدات دون إحداثيات مسجلة تظهر في القائمة فقط.</p>}</div>
    <Dialog open={zoom} onOpenChange={setZoom}><DialogContent dir="rtl" className="max-h-[90vh] max-w-5xl overflow-auto bg-card"><DialogTitle>مخطط {building === 'all' ? 'المشروع' : `مبنى ${building}`}</DialogTitle><DialogDescription>المخطط الأصلي المعتمد في النظام</DialogDescription>{image && building !== 'all' ? renderPlan() : <img src={masterPlan} alt="مخطط المشروع" className="mx-auto max-h-[72vh] object-contain" />}</DialogContent></Dialog>
  </section>;
}