# مبنى 1-ب + اختيار الجزء (أ / ب) في صفحة الحجز

## اللي هيحصل للعميل
1. يختار النشاط ثم المبنى (مثلاً مبنى 1).
2. لو المبنى له جزئين، يظهر له سؤال: **«عاوز مبنى 1 - أ ولا مبنى 1 - ب؟»** في كارتين، كل كارت فيه صورة مكان الجزء في المخطط العام وعدد الوحدات المتاحة فيه.
3. لما يختار «1 - أ» يشوف **مخطط 1-أ بس** ووحداته بس، وفوق جنب العنوان **صورة مكان 1-أ بس** (مش الاتنين). ونفس الكلام مع «1 - ب».
4. زر صغير «تغيير الجزء» يرجعه للاختيار، والوحدات اللي اختارها قبل كدا تفضل محفوظة.
5. المباني اللي ليها جزء واحد بس تفتح على طول زي دلوقتي.

ده هيشتغل على كل المباني اللي ليها جزئين: 1، 2، 3، 4، 5، 6، 14، 16، 17، 18، 19.

## وحدات مبنى 1-ب (من المخطط اللي بعتّه)
- 24 ورشة صيانة سيارات من **423 لـ 446**، مساحة **200 م²** لكل وحدة (زي الشيت ومبنى 1-أ).
- الإيجار زي 1-أ: **60,060** للداخلية و**65,000** للركنية (الركنية: 423، 434، 435، 446).
- كلها **متاحة للحجز** ومنشورة على الموقع على طول.
- على المخطط: الصف اللي فوق 435 ← 446، واللي تحت 423 ← 434، وكل وحدة زرار يتضغط عليه.

## ملاحظات
- **مبنى 2 - ب** (375 لـ 398) وحداته موجودة في النظام بس مفيش له مخطط، فهيظهر كقائمة وحدات بس لحد ما تبعتلي مخططه.
- المباني 4، 5، 6، 14، 16–19 مفيش لها صور مكان لكل جزء، فكارت الاختيار هيظهر من غير صورة لحد ما تبعتها.
- مش هغيّر أي حجز أو حالة وحدة موجودة، ومش هنشر الموقع.

## Technical details
**Tables touched (data only, no migration):** `units` (24 new rows), `audit_log`, `unit_status_history` — all through existing audited SECURITY DEFINER writers, run under an authenticated admin session:
1. `unit_import_preview(rows)` → must return 24 × `new`, 0 conflicts (building 1, activity «مراكز صيانة سيارات», area_m2 200, unit_type داخلية/ركنية, price 60060/65000).
2. `unit_import_apply(rows, file_name, reason)` → inserts as drafts with audit rows.
3. `initialize_unit_leasing_status(id, 'available', reason)` per unit.
4. `publish_unit(id, 'published', reason)` per unit (publish trigger checks building/activity/type/area).

**Functions/edge functions:** none created or changed. No migration.

**Files:**
- `src/assets/plans/section-1b.svg` (uploaded plan, same pattern as other section SVGs)
- `src/data/buildingPlans.ts` — add `EXTRA_SECTIONS[1]` (key `1b`) with geometry measured from the SVG clipPaths; export a `getBuildingSections(n)` helper returning `[{key:'a'|'b', label, unitNumbers}]`.
- `src/components/UnitGrid.tsx` — optional `section` prop renders only that section.
- `src/components/BuildingSectionPicker.tsx` (new) — two cards with location thumbnail + available count.
- `src/pages/Booking.tsx` — section state (persisted per tab with the existing booking session state + `?section=` param), picker before grid, pass `section` to `BuildingLocationPreview` and `UnitGrid`, «تغيير الجزء».
- Tests: section split for building 1 (399–422 → أ, 423–446 → ب) and the location helper returning one image per section.

**Verification steps:**
- SQL: `select unit_number, unit_type, area_m2, price, leasing_status, publish_state from units where building_number=1 and unit_number between 423 and 446 order by 1;` → 24 rows, available/published, prices as above.
- `select count(*) from audit_log where entity_id in (those ids);` → rows exist.
- Browser (desktop + mobile): /booking → صيانة سيارات → مبنى 1 → picker appears → «1 - ب» shows only 423–446 plan and only the 1-ب location image; switch to «1 - أ» shows only 399–422 and the 1-أ image.
