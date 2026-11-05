# المرحلة 0 / الطلب 2 — الواجهات الخارجية والنصوص

## 1) الـ API القديمة (api)
- قراءة فقط: حذف كل مسارات POST/PATCH/DELETE (units، bookings، tenants، tenant-accounts links). أي طلب غير GET/HEAD/OPTIONS بيرجع 405.
- إزالة البيانات الشخصية: حذف مسارات `/customers` و`/users` و`/tenants` و`/tenant-accounts` و`/invoices` و`/audit-log` (ترجع 410 برسالة إنها اتشالت). `/bookings` ترجع بس: id الحقيقي، الحالة، عدد الوحدات، المساحة، أرقام الوحدات، التواريخ (من غير اسم/جوال/إيميل/سجل/رقم هوية). `/units` و`/buildings` و`/stats` بحقول الوحدة والأعداد المجمعة بس.
- مفيش `crypto.randomUUID()` مكان رقم الحجز؛ بيرجع الـ id الحقيقي من قاعدة البيانات (ومسار الإنشاء نفسه هيتشال لأنه كتابة).
- CORS: قائمة مسموحة في `app_settings` بمفتاح `api_cors_allowlist` (قيمة مبدئية: الدومينات الحالية mnicity/mnicejar/lovable). الأصل غير المسموح ما ياخدش هيدر CORS.
- مفاتيح API وصفحة التوثيق وخادم MCP يفضلوا شغالين؛ أحدّث `ApiDocs.tsx` و`MNICITY-API-DOCUMENTATION.md` وأراجع أدوات MCP اللي بتنادي مسارات اتشالت.
- `crm-api` (منفصلة) ما تتغيرش.

## 2) مزامنة شيت المباني (buildings-sheets-sync)
- إلغاء «pull» نهائيًا (يرجع 410)، وإزالة زرّه من صفحة المزامنة. «push» بس.
- الحالة المجهولة ما تتحولش أبدًا لـ«متاحة»: تتسجل كخطأ في سجل المزامنة.
- عنوان لوحة الشيت: «مدينة المعجار» ← «MNICity».

## 3) النصوص العامة
- «تم تأكيد حجزك» (3 أماكن في صفحة الحجز) ← «استلمنا طلب حجزك، وبيتواصل معك فريق التأجير لتأكيده».
- إزالة وعد التسليم 4–6 أشهر من TenantNotice (الجملة تبقى عن بدء الأعمال بس).
- نص الحساب ← «إذا سجّلت حساب، نحفظ بياناتك وتتعبّى تلقائيًا في طلباتك الجاية».

## 4) نوع الهوية
- عمود جديد `id_type` على bookings (و customer_profiles) بقيم: commercial_registration | national_id | iqama (إضافة فقط، السجلات القديمة تبقى فاضية).
- القواعد: سجل تجاري/رقم موحد = 10 أرقام يبدأ بـ7، هوية وطنية = 10 أرقام يبدأ بـ1، إقامة = 10 أرقام يبدأ بـ2.
- في الفورم: اختيار النوع + تحقق فوري. في `create_booking`: باراميتر جديد `_id_type` وتحقق في قاعدة البيانات (نسخة إضافية من الدالة متوافقة مع الاستدعاء القديم).
- ملاحظة: القاعدة الحالية تقبل 9 أرقام للرقم الموحد؛ هتبقى 10 بس.

## 5) تنبيه الفريق
- إلغاء تنبيه Telegram عند فتح الملخص. التنبيه يتبعت بس بعد ما العميل يضغط «تأكيد الحجز» وينجح الحفظ (ويفضل تنبيه الفشل عند فشل الإرسال).

## اللي هيتلمس
- جداول: `app_settings` (صف جديد)، `bookings` و`customer_profiles` (عمود `id_type`).
- دوال: `create_booking` (توقيع جديد بـ`_id_type`)، دالة تحقق `validate_identity(id_type, number)`.
- Edge: `api`، `buildings-sheets-sync`، `mcp` (لو بيستخدم مسارات اتشالت).
- ملفات: `src/pages/Booking.tsx`، `src/components/CustomerForm.tsx`، `src/components/TenantNotice.tsx`، `src/pages/ApiDocs.tsx`، صفحة مزامنة الشيت، `MNICITY-API-DOCUMENTATION.md`، `src/lib/identity.ts` + اختبار.

## خطة الـ migration (إضافية فقط)
1. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS id_type text` + CHECK بقيم الأنواع الثلاثة (NOT VALID علشان القديم).
2. إدراج `api_cors_allowlist` في app_settings بـ ON CONFLICT DO NOTHING.
3. `CREATE OR REPLACE FUNCTION validate_identity` و`create_booking` بالتوقيع الجديد (القديم يفضل).
4. استعلام تحقق في الآخر.

## التحقق بعد التنفيذ
- طلب PATCH/DELETE على api يرجع 405؛ `/bookings` من غير أي اسم أو جوال؛ أصل غير مسموح من غير CORS.
- مزامنة pull ترجع 410.
- اختبارات لقواعد الهوية الثلاثة، وتجربة حجز فعلية: التنبيه ما يوصلش عند فتح الملخص ويوصل بعد التأكيد.
