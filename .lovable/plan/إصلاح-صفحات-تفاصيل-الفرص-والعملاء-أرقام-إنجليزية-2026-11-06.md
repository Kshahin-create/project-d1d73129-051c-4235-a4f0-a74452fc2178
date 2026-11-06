# إصلاح صفحات تفاصيل الفرص والعملاء + أرقام إنجليزية

## التشخيص
- المسارات في `App.tsx` بتمرر المعرف باسم `:opportunityId` و`:partyId`، لكن صفحتي `CrmOpportunity` و`CrmParty` بتقرأ `useParams<{id}>()` — فالمعرف بيطلع فارغ، والاستعلامات متعطلة، والصفحة تظهر فاضية («مش بلاقي حاجة»).
- الأرقام العربية (١٢٣) مصدرها `toLocaleString("ar-SA")` اللي بيخرج أرقامًا عربية؛ المطلوب أرقام إنجليزية (123).

## التغييرات (واجهة فقط — لا قاعدة بيانات، لا migrations، لا edge functions)

1. `src/pages/crm/CrmOpportunity.tsx`: قراءة المعرف من `opportunityId` (مع دعم `id` كاحتياطي).
2. `src/pages/crm/CrmParty.tsx`: قراءة المعرف من `partyId` (مع دعم `id` كاحتياطي).
3. `src/lib/format.ts` (جديد): دوال `formatDateTime` / `formatDate` بأرقام لاتينية (`ar-SA-u-nu-latn`، توقيت الرياض).
4. استبدال كل استدعاءات `toLocaleString("ar-SA"...)` في صفحات CRM والمتابعة بالدالة المشتركة:
   - `src/pages/crm/CrmOpportunity.tsx`
   - `src/pages/crm/CrmParty.tsx`
   - `src/pages/crm/CrmPipeline.tsx`
   - `src/pages/crm/CrmTeamPerformance.tsx`
   - `src/pages/admin/TeamFollowupViews.tsx`
   - `src/pages/crm/CrmUnassigned.tsx` (إن وُجد تنسيق تواريخ فيه)

## التحقق
- فتح صفحة تفاصيل فرصة وعميل في المعاينة والتأكد من ظهور البيانات.
- التأكد بصريًا أن التواريخ والأعداد بأرقام إنجليزية.
- تشغيل اختبارات CRM الموجودة + البناء.
- لا نشر للموقع.
