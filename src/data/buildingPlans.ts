/**
 * إحداثيات الوحدات على صور مخططات المباني (نسبية بالنسبة المئوية).
 * كل وحدة تُعرّف بـ x, y (الزاوية العلوية اليسرى) و w, h (العرض والارتفاع).
 * النسب تكون من 0 إلى 100.
 *
 * Building plan unit coordinates (relative percentages on the plan image).
 */

export interface PlanUnitArea {
  unitNumber: number;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
}

export interface PlanLayout {
  /** نسبة العرض إلى الارتفاع للصورة الأصلية، تُستخدم للحفاظ على التناسب */
  aspectRatio: number;
  units: PlanUnitArea[];
}

/**
 * مبنى رقم 1: صفان من 12 وحدة.
 * الصف العلوي (411-422) والصف السفلي (399-410)
 * الترتيب من اليمين إلى اليسار في الصورة.
 */
function buildBuilding1Layout(): PlanLayout {
  const units: PlanUnitArea[] = [];

  // إعدادات هندسية مستخرجة من الصورة بصرياً
  const left = 3.2;       // % - بداية أول عمود من اليسار
  const right = 96.8;     // % - نهاية آخر عمود
  const cols = 12;
  const colWidth = (right - left) / cols; // ≈ 7.8%

  // الصف العلوي: 411 (يسار) → 422 (يمين)... لكن الصورة بالعكس: 422 يمين، 411 يسار
  // عند العرض: x=0 هو اليسار. 411 في أقصى اليسار، 422 في أقصى اليمين.
  const topY = 24.5;
  const topH = 28.5;
  for (let i = 0; i < cols; i++) {
    units.push({
      unitNumber: 411 + i, // 411..422 من اليسار لليمين
      x: left + i * colWidth,
      y: topY,
      w: colWidth,
      h: topH,
    });
  }

  // الصف السفلي: 399 (يسار) → 410 (يمين)
  const botY = 56.5;
  const botH = 28.5;
  for (let i = 0; i < cols; i++) {
    units.push({
      unitNumber: 399 + i, // 399..410 من اليسار لليمين
      x: left + i * colWidth,
      y: botY,
      w: colWidth,
      h: botH,
    });
  }

  return {
    aspectRatio: 1920 / 1280,
    units,
  };
}

export const BUILDING_PLANS: Record<number, PlanLayout> = {
  1: buildBuilding1Layout(),
};

export function getPlanLayout(buildingNumber: number): PlanLayout | undefined {
  return BUILDING_PLANS[buildingNumber];
}
