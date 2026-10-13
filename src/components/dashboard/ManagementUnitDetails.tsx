import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { fmt, number, statusClass, statusLabel, type DashboardUnit, type CollectionRow, type BookingRow, type TenantRow } from '@/lib/dashboardMetrics';
import { readDashboardRows } from '@/hooks/useDashboardData';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type UnitFile = { id: string; unit_id: string; file_name: string; storage_path: string };
type AccountFile = { id: string; tenant_account_id: string; custom_name: string; storage_path: string; is_archived: boolean };
type BookingLink = { booking_id: string; bookings: BookingRow | null };
export function ManagementUnitDetails({ unit, onClose, userId }: { unit: DashboardUnit | null; onClose: () => void; userId?: string }) {
  const detail = useQuery({ queryKey: ['dashboard-detail', userId, unit?.id], enabled: !!unit && !!userId, queryFn: async () => {
    if (!unit) throw new Error('No unit');
    const [tenants, collections, files, bookings, accounts] = await Promise.all([
      supabase.from('tenants').select('id, unit_id, tenant_name, business_name, phone, activity_type').eq('unit_id', unit.id),
      supabase.from('unit_collections').select('id, unit_id, amount, created_at, is_archived').eq('unit_id', unit.id).eq('is_archived', false),
      supabase.from('unit_files').select('id, unit_id, file_name, storage_path').eq('unit_id', unit.id),
      supabase.from('booking_units').select('booking_id, bookings:booking_id(id, status, customer_full_name, offer_number, created_at, expires_at, user_id, units_count)').eq('unit_id', unit.id),
      supabase.from('tenant_account_units').select('tenant_account_id').eq('unit_id', unit.id),
    ]);
    const errors = [tenants, collections, files, bookings, accounts].filter(r => r.error);
    if (errors.length) throw new Error('تعذر قراءة بعض تفاصيل الوحدة');
    const accountIds = new Set((accounts.data ?? []).map(a => a.tenant_account_id));
    const accountFiles = accountIds.size ? (await readDashboardRows<AccountFile>('tenant_account_files', 'id, tenant_account_id, custom_name, storage_path, is_archived')).filter(f => !f.is_archived && accountIds.has(f.tenant_account_id)) : [];
    return { tenants: tenants.data as TenantRow[], collections: collections.data as CollectionRow[], files: files.data as UnitFile[], bookings: (bookings.data as unknown as BookingLink[]).flatMap(b => b.bookings ? [b.bookings] : []), accountFiles };
  } });
  const download = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
    if (error || !data) { toast.error('تعذر فتح الملف'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  return <Dialog open={!!unit} onOpenChange={v => { if (!v) onClose(); }}><DialogContent dir="rtl" className="max-h-[90vh] w-[calc(100%-24px)] max-w-3xl overflow-y-auto bg-card">
    <DialogTitle className="pr-7 text-xl">مبنى <span className="num">{unit?.building_number}</span> · وحدة <span className="num">{unit?.unit_number}</span></DialogTitle><DialogDescription>تفاصيل السجلات الحالية · عرض فقط</DialogDescription>
    {unit && <div className="flex flex-wrap items-center gap-3 border-b pb-4 text-sm"><span className={`rounded-md border px-2 py-1 ${statusClass(unit.status)}`}>{statusLabel(unit.status)}</span><span>{unit.activity ?? 'نشاط غير مسجل'}</span><span><span className="num">{fmt(unit.area)}</span> م²</span><span>الإيجار السنوي <span className="num font-bold">{fmt(unit.price)}</span> ر.س</span></div>}
    {detail.isPending ? <p role="status" className="py-8 text-center">جارٍ قراءة التفاصيل…</p> : detail.isError ? <div role="alert" className="py-6 text-destructive">تعذر تحميل التفاصيل. <Button variant="outline" onClick={() => detail.refetch()}>إعادة المحاولة</Button></div> : detail.data && <Tabs defaultValue="bookings" dir="rtl"><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="bookings">الحجوزات ({detail.data.bookings.length})</TabsTrigger><TabsTrigger value="tenants">المستأجرون ({detail.data.tenants.length})</TabsTrigger><TabsTrigger value="collections">التحصيلات ({detail.data.collections.length})</TabsTrigger><TabsTrigger value="files">الملفات ({detail.data.files.length + detail.data.accountFiles.length})</TabsTrigger></TabsList>
      <TabsContent value="bookings"><div className="divide-y">{detail.data.bookings.map(b => <div key={b.id} className="flex flex-wrap justify-between gap-2 py-4"><div className="font-semibold">{b.customer_full_name}<div className="mt-1 text-xs text-muted-foreground">{b.offer_number ?? 'بدون رقم عرض'} · {b.status === 'pending' ? 'قيد الانتظار' : b.status === 'confirmed' ? 'مؤكد' : b.status === 'expired' ? 'منتهي' : b.status === 'cancelled' ? 'ملغي' : b.status}</div></div><span className="num text-xs">{new Date(b.created_at).toLocaleDateString('en-GB')}</span></div>)}</div>{!detail.data.bookings.length && <Empty />}<Button asChild variant="link"><Link to="/admin/bookings">صفحة الحجوزات</Link></Button></TabsContent>
      <TabsContent value="tenants">{detail.data.tenants.map(t => <div key={t.id} className="border-b py-4"><p className="font-semibold">{t.tenant_name}</p><p className="mt-1 text-sm text-muted-foreground">{t.business_name ?? '—'} · <span className="num">{t.phone ?? '—'}</span></p></div>)}{!detail.data.tenants.length && <Empty />}<Button asChild variant="link"><Link to="/admin/tenant-accounts">صفحة المستأجرين</Link></Button></TabsContent>
      <TabsContent value="collections"><p className="my-4 text-sm">إجمالي التحصيلات المسجلة غير المؤرشفة: <span className="num font-bold text-primary">{fmt(detail.data.collections.reduce((s, c) => s + number(c.amount), 0))}</span> ر.س</p>{detail.data.collections.map(c => <div key={c.id} className="flex justify-between border-b py-3 text-sm"><span className="num">{fmt(number(c.amount))} ر.س</span><span className="num text-muted-foreground">{new Date(c.created_at).toLocaleDateString('en-GB')}</span></div>)}{!detail.data.collections.length && <Empty />}</TabsContent>
      <TabsContent value="files">{detail.data.files.map(f => <File key={f.id} name={f.file_name} onOpen={() => download('unit-files', f.storage_path)} />)}{detail.data.accountFiles.map(f => <File key={f.id} name={`${f.custom_name} · ملف حساب المستأجر`} onOpen={() => download('tenant-account-files', f.storage_path)} />)}{!detail.data.files.length && !detail.data.accountFiles.length && <Empty />}</TabsContent>
    </Tabs>}
  </DialogContent></Dialog>;
}
function Empty() { return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد سجلات</p>; }
function File({ name, onOpen }: { name: string; onOpen: () => void }) { return <div className="flex items-center justify-between gap-3 border-b py-3"><span className="flex min-w-0 items-center gap-2 break-words text-sm"><FileText className="h-4 w-4 shrink-0 text-primary" />{name}</span><Button size="icon" variant="outline" title="فتح الملف" aria-label={`فتح ${name}`} onClick={onOpen}><Download /></Button></div>; }