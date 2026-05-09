
## الملخص
بناء نظام كامل للمستأجرين: كل مستأجر = حساب مرتبط بوحداته (واحدة أو أكثر)، يدخل بإيميل/باسورد أو OTP جوال أو لينك مرة واحدة، ويشوف وحداته وفواتيره ومدفوعاته. الأدمن يقدر يدير الحسابات (إنشاء، تغيير كلمة سر، توليد لينك دخول).

## التغييرات في قاعدة البيانات

### 1. دور جديد + جدول ربط
- إضافة `'tenant'` لـ `app_role` enum
- جدول جديد `tenant_accounts`:
  - `id, user_id (auth.users), full_name, phone, email, business_name, notes, created_by, timestamps`
  - علاقة 1-1 مع auth user (ينشأ مع الحساب)
- جدول ربط `tenant_account_units`:
  - `tenant_account_id, unit_id, tenant_id (للسجل)` — يربط الحساب بكل وحداته
- جدول `invoices`:
  - `id, tenant_account_id, unit_id, amount, due_date, paid, paid_at, paid_amount, period_start, period_end, notes, created_by, timestamps`
- جدول `tenant_login_links`:
  - `id, tenant_account_id, token_hash, expires_at, used_at, created_by`

### 2. RLS
- `tenant_accounts`: المستأجر يشوف نفسه، الأدمن/المدير يدير الكل
- `tenant_account_units`: المستأجر يشوف صفوفه، الأدمن/المدير يديرها
- `invoices`: المستأجر يشوف فواتيره فقط، الأدمن/المدير يديرها
- `units` SELECT: إضافة policy للمستأجر يشوف وحداته فقط (مع الحفاظ على Anyone can view units الحالي)

### 3. Functions / RPCs
- `admin_create_tenant_account(name, phone, email, password, unit_ids[])` — security definer:
  - ينشئ user في auth.users عبر service role من edge function
  - ينشئ `tenant_accounts` و`tenant_account_units` ويعطي دور `tenant`
- `admin_set_tenant_password(tenant_account_id, new_password)` — يستدعى من edge function
- `admin_generate_tenant_magic_link(tenant_account_id)` — يولد token عشوائي، يخزن hash، يرجع الـ URL
- `consume_tenant_magic_link(token)` — يتحقق + يرجع access/refresh عبر edge function
- `admin_link_tenant_units(tenant_account_id, unit_ids[])` / `admin_unlink_tenant_unit(...)` 
- ربط تلقائي عند `confirm_booking`: لو فيه عميل بنفس الإيميل/الجوال له حساب → يربط الوحدات تلقائياً (لو مفيش حساب يفضل يدوي)

## Edge Functions
- `tenant-admin` (POST) — للأدمن: create/update/delete tenant accounts، set password، generate magic link. باستخدام service role.
- `tenant-magic-login` (POST) — يستهلك token ويرجع session.

## واجهة الأدمن
- صفحة جديدة `/admin/tenants-accounts` (أو إضافة تبويب لـ AdminTenants):
  - قائمة الحسابات + بحث
  - زر "إنشاء حساب" (form: اسم، إيميل، جوال، باسورد، اختيار وحدات)
  - لكل حساب: عرض الوحدات المرتبطة، إضافة/إزالة وحدة، تغيير كلمة السر، توليد لينك دخول (يعرض الرابط للنسخ + زر واتساب)، إدارة الفواتير (إنشاء فاتورة، تحديد كمدفوعة)
- زر "إنشاء حساب للعميل" داخل AdminBookings عند تأكيد الحجز

## واجهة المستأجر
- مسار `/tenant` محمي بدور `tenant`:
  - الوحدات: كروت بكل وحدة (مبنى، رقم، نوع، نشاط، مساحة، سعر سنوي، تاريخ البداية)
  - الفواتير: جدول (التاريخ، الوحدة، المبلغ، الحالة، تاريخ السداد)، فلتر "غير مدفوع/مدفوع"
  - الملف الشخصي: عرض البيانات
- صفحة `/tenant-login/:token` تستهلك الـ magic link وتسجل الدخول وتحوّل لـ `/tenant`

## التفاصيل التقنية
- Magic link: 32-byte random token، hash بـ SHA-256، صلاحية 24 ساعة، يُحرق بعد الاستخدام. يستخدم `signInWithPassword` بكلمة سر مؤقتة عشوائية تُعاد كتابتها بعد الاستخدام، أو يُستخدم `admin.generateLink` من service role.
- التفضيل: استخدام `supabase.auth.admin.generateLink({ type: 'magiclink' })` من service role في edge function وإرجاع `action_link` للأدمن (أبسط وأأمن).
- `useAuth` hook: إضافة `isTenant` boolean
- AdminSidebar: إضافة لينك "حسابات المستأجرين"
- Header: لو `isTenant` يوجه `/tenant` بدل `/dashboard`

## ملفات تتعدل/تُنشأ
- `supabase/migrations/...` (schema + RLS + functions)
- `supabase/functions/tenant-admin/index.ts`
- `supabase/functions/tenant-magic-login/index.ts`
- `src/hooks/useAuth.ts` (إضافة isTenant)
- `src/components/AdminSidebar.tsx`
- `src/pages/AdminTenantAccounts.tsx` (جديد)
- `src/pages/TenantPortal.tsx` (جديد)
- `src/pages/TenantMagicLogin.tsx` (جديد)
- `src/App.tsx` (مسارات جديدة)
- `src/pages/AdminBookings.tsx` (زر إنشاء حساب)
