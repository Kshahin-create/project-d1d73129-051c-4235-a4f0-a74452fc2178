/**
 * إحداثيات الوحدات على صور مخططات المباني (نسبية بالنسبة المئوية).
 * كل وحدة تُعرّف بـ x, y (الزاوية العلوية اليسرى) و w, h (العرض والارتفاع).
 * النسب من 0 إلى 100. القيم مُستخرجة بصريًا من صور المخططات الأصلية
 * بحيث تنطبق مربعات الاختيار التفاعلية على حدود الوحدات الخضراء تمامًا.
 */

export interface PlanUnitArea {
  unitNumber: number;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
}

export interface PlanLayout {
  aspectRatio: number;
  units: PlanUnitArea[];
}

interface BuildingGeometry {
  /** إحداثيات أعمدة الـ12 وحدة من اليسار لليمين [xStart, xEnd] بالنسبة المئوية */
  columns: [number, number][];
  topY: number;
  topH: number;
  botY: number;
  botH: number;
  aspectRatio: number;
}

function buildLayout(g: BuildingGeometry, topStart: number, botStart: number): PlanLayout {
  const units: PlanUnitArea[] = [];
  for (let i = 0; i < g.columns.length; i++) {
    const [x1, x2] = g.columns[i];
    units.push({
      unitNumber: topStart + i,
      x: x1,
      y: g.topY,
      w: x2 - x1,
      h: g.topH,
    });
  }
  for (let i = 0; i < g.columns.length; i++) {
    const [x1, x2] = g.columns[i];
    units.push({
      unitNumber: botStart + i,
      x: x1,
      y: g.botY,
      w: x2 - x1,
      h: g.botH,
    });
  }
  return { aspectRatio: g.aspectRatio, units };
}

// ===== الإحداثيات المُقاسة من الصور الأصلية =====

const B1: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-1.svg
  aspectRatio: 900 / 600,
  topY: 32.90, topH: 13.92,
  botY: 52.48, botH: 13.58,
  columns: [
    [2.19, 9.82], [10.16, 17.79], [18.13, 25.76], [26.10, 33.73],
    [34.06, 41.70], [42.03, 49.66], [50.00, 57.63], [57.97, 65.60],
    [65.94, 73.57], [73.91, 81.54], [81.88, 89.51], [89.85, 97.48],
  ],
};

const B2: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-2.svg
  aspectRatio: 900 / 600,
  topY: 33.09, topH: 13.79,
  botY: 52.50, botH: 13.45,
  columns: [
    [2.64, 10.20], [10.53, 18.09], [18.42, 25.99], [26.32, 33.88],
    [34.21, 41.77], [42.11, 49.67], [50.00, 57.56], [57.90, 65.46],
    [65.79, 73.35], [73.68, 81.24], [81.58, 89.14], [89.47, 97.03],
  ],
};

const B3: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-3.svg
  aspectRatio: 900 / 600,
  topY: 32.99, topH: 13.87,
  botY: 52.51, botH: 13.53,
  columns: [
    [2.35, 9.96], [10.29, 17.90], [18.24, 25.84], [26.18, 33.78],
    [34.12, 41.72], [42.06, 49.67], [50.00, 57.61], [57.94, 65.55],
    [65.89, 73.49], [73.83, 81.43], [81.77, 89.38], [89.71, 97.32],
  ],
};

const B4: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-4.svg
  aspectRatio: 900 / 600,
  topY: 32.99, topH: 13.87,
  botY: 52.51, botH: 13.53,
  columns: [
    [2.36, 9.96], [10.30, 17.90], [18.24, 25.85], [26.18, 33.79],
    [34.12, 41.73], [42.06, 49.67], [50.00, 57.61], [57.94, 65.55],
    [65.88, 73.49], [73.82, 81.43], [81.76, 89.37], [89.70, 97.31],
  ],
};

const B5: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-5.svg
  aspectRatio: 900 / 600,
  topY: 32.97, topH: 13.89,
  botY: 52.52, botH: 13.55,
  columns: [
    [2.29, 9.91], [10.24, 17.86], [18.19, 25.81], [26.15, 33.76],
    [34.10, 41.71], [42.05, 49.67], [50.00, 57.62], [57.95, 65.57],
    [65.91, 73.52], [73.86, 81.47], [81.81, 89.43], [89.76, 97.38],
  ],
};

const B6: BuildingGeometry = {
  // SVG viewBox 900x600 — measured exactly from clipPaths in building-6.svg
  aspectRatio: 900 / 600,
  topY: 32.96, topH: 13.89,
  botY: 52.52, botH: 13.55,
  columns: [
    [2.27, 9.89], [10.22, 17.84], [18.18, 25.80], [26.13, 33.75],
    [34.09, 41.71], [42.05, 49.67], [50.00, 57.62], [57.96, 65.58],
    [65.91, 73.53], [73.87, 81.49], [81.83, 89.44], [89.78, 97.40],
  ],
};

// مبنى 7 — مخطط رأسي (portrait) viewBox 600x900، عمودين × 11 صف، 22 وحدة
const B7_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    // العمود الأيسر (من الأعلى للأسفل): 85 (ركنية)، 84→76، 75 (ركنية)
    { unitNumber: 85, x: 35.11, y: 10.36, w: 10.77, h: 12.48 },
    { unitNumber: 84, x: 35.19, y: 23.23, w: 14.30, h: 6.08 },
    { unitNumber: 83, x: 35.19, y: 29.72, w: 14.49, h: 6.21 },
    { unitNumber: 82, x: 35.19, y: 36.15, w: 14.49, h: 6.17 },
    { unitNumber: 81, x: 35.19, y: 42.67, w: 14.61, h: 6.36 },
    { unitNumber: 80, x: 35.07, y: 49.28, w: 14.73, h: 6.14 },
    { unitNumber: 79, x: 35.19, y: 55.75, w: 14.61, h: 6.05 },
    { unitNumber: 78, x: 35.13, y: 62.14, w: 14.61, h: 6.31 },
    { unitNumber: 77, x: 35.13, y: 68.81, w: 14.61, h: 6.15 },
    { unitNumber: 76, x: 35.03, y: 75.22, w: 14.61, h: 6.15 },
    { unitNumber: 75, x: 34.68, y: 81.70, w: 11.20, h: 12.88 },
    // العمود الأيمن (من الأعلى للأسفل): 96 (ركنية)، 95→87، 86 (ركنية)
    { unitNumber: 96, x: 53.35, y: 10.36, w: 10.76, h: 12.50 },
    { unitNumber: 95, x: 49.93, y: 23.23, w: 14.20, h: 6.09 },
    { unitNumber: 94, x: 50.02, y: 29.71, w: 14.08, h: 6.22 },
    { unitNumber: 93, x: 50.08, y: 36.15, w: 14.05, h: 6.17 },
    { unitNumber: 92, x: 50.08, y: 42.67, w: 14.30, h: 6.36 },
    { unitNumber: 91, x: 50.02, y: 49.28, w: 14.38, h: 6.14 },
    { unitNumber: 90, x: 49.96, y: 55.75, w: 14.50, h: 6.05 },
    { unitNumber: 89, x: 50.08, y: 62.14, w: 14.50, h: 6.31 },
    { unitNumber: 88, x: 49.88, y: 68.81, w: 14.76, h: 6.15 },
    { unitNumber: 87, x: 49.88, y: 75.22, w: 14.61, h: 6.15 },
    { unitNumber: 86, x: 53.46, y: 81.61, w: 10.92, h: 12.96 },
  ],
};

// مبنى 8 — مخطط رأسي (portrait) viewBox 600x900، عمودين × 11 صف، 22 وحدة
const B8_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    // العمود الأيسر (من الأعلى للأسفل): 107 (ركنية)، 106→98، 97 (ركنية)
    { unitNumber: 107, x: 35.11, y: 10.36, w: 10.77, h: 12.48 },
    { unitNumber: 106, x: 35.19, y: 23.23, w: 14.30, h: 6.08 },
    { unitNumber: 105, x: 35.19, y: 29.72, w: 14.49, h: 6.21 },
    { unitNumber: 104, x: 35.19, y: 36.15, w: 14.49, h: 6.17 },
    { unitNumber: 103, x: 35.19, y: 42.67, w: 14.61, h: 6.36 },
    { unitNumber: 102, x: 35.07, y: 49.28, w: 14.73, h: 6.14 },
    { unitNumber: 101, x: 35.19, y: 55.75, w: 14.61, h: 6.05 },
    { unitNumber: 100, x: 35.13, y: 62.14, w: 14.61, h: 6.31 },
    { unitNumber: 99, x: 35.13, y: 68.81, w: 14.61, h: 6.15 },
    { unitNumber: 98, x: 35.03, y: 75.22, w: 14.61, h: 6.15 },
    { unitNumber: 97, x: 34.68, y: 81.70, w: 11.20, h: 12.88 },
    // العمود الأيمن (من الأعلى للأسفل): 118 (ركنية)، 117→109، 108 (ركنية)
    { unitNumber: 118, x: 53.35, y: 10.36, w: 10.76, h: 12.50 },
    { unitNumber: 117, x: 49.93, y: 23.23, w: 14.20, h: 6.09 },
    { unitNumber: 116, x: 50.02, y: 29.71, w: 14.08, h: 6.22 },
    { unitNumber: 115, x: 50.08, y: 36.15, w: 14.05, h: 6.17 },
    { unitNumber: 114, x: 50.08, y: 42.67, w: 14.30, h: 6.36 },
    { unitNumber: 113, x: 50.02, y: 49.28, w: 14.38, h: 6.14 },
    { unitNumber: 112, x: 49.96, y: 55.75, w: 14.50, h: 6.05 },
    { unitNumber: 111, x: 50.08, y: 62.14, w: 14.50, h: 6.31 },
    { unitNumber: 110, x: 49.88, y: 68.81, w: 14.76, h: 6.15 },
    { unitNumber: 109, x: 49.88, y: 75.22, w: 14.61, h: 6.15 },
    { unitNumber: 108, x: 53.46, y: 81.61, w: 10.92, h: 12.96 },
  ],
};

export const BUILDING_PLANS: Record<number, PlanLayout> = {
  // مبنى 1 — الصف العلوي 411→422 (يسار→يمين)، الصف السفلي 399→410
  1: buildLayout(B1, 411, 399),
  // مبنى 2 — الصف العلوي 363→374، الصف السفلي 351→362
  2: buildLayout(B2, 363, 351),
  // مبنى 3 — الصف العلوي 315→326، الصف السفلي 303→314
  3: buildLayout(B3, 315, 303),
  // مبنى 4 — الصف العلوي 267→278، الصف السفلي 255→266
  4: buildLayout(B4, 267, 255),
  // مبنى 5 — الصف العلوي 219→230، الصف السفلي 207→218
  5: buildLayout(B5, 219, 207),
  // مبنى 6 — الصف العلوي 171→182، الصف السفلي 159→170
  6: buildLayout(B6, 171, 159),
  7: B7_LAYOUT,
  8: B8_LAYOUT,
};

export function getPlanLayout(buildingNumber: number): PlanLayout | undefined {
  return BUILDING_PLANS[buildingNumber];
}
