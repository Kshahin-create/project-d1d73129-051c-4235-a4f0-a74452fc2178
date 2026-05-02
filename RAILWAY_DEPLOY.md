# 🚂 رفع المشروع على Railway

## الخطوات

### 1. إنشاء المشروع
- ادخل على [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
- اختار الريبو بتاع المشروع

### 2. إضافة متغيرات البيئة
من تبويب **Variables** أضف:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://wqzseofoerwevfebguse.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (الـ anon key من ملف `.env`) |
| `VITE_SUPABASE_PROJECT_ID` | `wqzseofoerwevfebguse` |

> ⚠️ مهم: المتغيرات لازم تبدأ بـ `VITE_` عشان تظهر في الـ build.

### 3. الإعدادات تلقائية
- **Build:** `npm install && npm run build` (من `nixpacks.toml`)
- **Start:** `serve -s dist -l $PORT` (يدعم SPA routing)
- **Port:** Railway هيحقن `$PORT` تلقائياً

### 4. توليد الدومين
- من **Settings** → **Networking** → **Generate Domain**
- هيديك رابط زي `your-app.up.railway.app`

### 5. (اختياري) دومين مخصص
- **Settings** → **Custom Domain** → ضيف دومينك
- اضبط الـ CNAME عند مسجّل الدومين

## ملاحظات مهمة

✅ الـ Backend (Supabase / Lovable Cloud) شغّال زي ما هو — مش محتاج تعمله أي حاجة.
✅ الـ Edge Functions ومفاتيح API بتشتغل من نفس الـ Supabase.
✅ الـ deep links وreload الصفحات شغّالين عن طريق `serve -s` و `_redirects`.

## استكشاف الأخطاء

- **صفحة بيضاء**: تأكد إن متغيرات `VITE_*` متضافة في Variables.
- **404 عند Refresh**: الإعداد جاهز، لكن لو ظهرت تأكد إن `serve` بيشتغل بـ flag `-s`.
- **Build failed**: شوف اللوجز في Railway، عادةً بسبب نقص متغير بيئة.
