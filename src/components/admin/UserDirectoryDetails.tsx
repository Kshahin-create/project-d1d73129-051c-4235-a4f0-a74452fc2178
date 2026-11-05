import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { directoryName, type DirectoryDetails } from "@/lib/userDirectory";

const date = (value?: string | null) => value ? new Date(value).toLocaleString("ar-EG", { timeZone: "Asia/Riyadh" }) : "غير مسجّل";

export function DirectoryAvatar({ row, className = "h-11 w-11" }: { row: DirectoryDetails; className?: string }) {
  const name = directoryName(row);
  return <Avatar className={`${className} shrink-0 rounded-lg`}>
    <AvatarImage src={row.avatar_url || undefined} alt={name} className="object-cover" />
    <AvatarFallback className="rounded-lg bg-secondary text-secondary-foreground">{name.slice(0, 2)}</AvatarFallback>
  </Avatar>;
}

function Field({ label, value, ltr = false }: { label: string; value?: string | null; ltr?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]" dir={ltr ? "ltr" : undefined}>{value || "غير مسجّل"}</dd></div>;
}

export function UserDirectoryDetails({ row, onClose }: { row: (DirectoryDetails & { user_id: string; created_at: string }) | null; onClose: () => void }) {
  return <Dialog open={!!row} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir="rtl" className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg">
      {row && <>
        <DialogHeader className="pt-4">
          <div className="flex items-center gap-3"><DirectoryAvatar row={row} className="h-16 w-16" /><DialogTitle className="break-words leading-normal">{directoryName(row)}</DialogTitle></div>
          <DialogDescription>بيانات الحساب المسجّلة</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" value={row.full_name || row.display_name} />
          <Field label="اسم العرض" value={row.display_name} />
          <Field label="رقم الجوال" value={row.phone} ltr />
          <Field label="البريد الإلكتروني" value={row.contact_email || row.email} ltr />
          <Field label="اسم المنشأة" value={row.business_name} />
          <Field label="النشاط" value={row.activity_type} />
          <Field label="تاريخ التسجيل (توقيت السعودية)" value={date(row.created_at)} />
          <Field label="آخر دخول للحساب (توقيت السعودية)" value={date(row.last_sign_in_at)} />
          <Field label="آخر تحديث للبيانات" value={date(row.profile_updated_at)} />
          <Field label="معرّف الحساب" value={row.user_id} ltr />
          <div className="sm:col-span-2"><Field label="ملاحظات" value={row.notes} /></div>
        </dl>
        <section className="border-t border-border pt-4">
          <h3 className="mb-3 font-semibold">آخر موقع دخول مسجّل</h3>
          <p className="mb-4 text-xs text-muted-foreground">الموقع تقديري حسب IP، ومش دليل على جنسية الشخص أو مكانه الحالي.</p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="عنوان IP" value={row.ip_address} ltr />
            <Field label="الدولة" value={row.country} />
            <Field label="المنطقة" value={row.region} />
            <Field label="المدينة" value={row.city} />
            <Field label="مزوّد الإنترنت" value={row.isp} />
            <Field label="وقت تسجيل الموقع (توقيت السعودية)" value={date(row.access_recorded_at)} />
            <div className="sm:col-span-2"><Field label="الجهاز والمتصفح" value={row.user_agent} ltr /></div>
          </dl>
        </section>
      </>}
    </DialogContent>
  </Dialog>;
}