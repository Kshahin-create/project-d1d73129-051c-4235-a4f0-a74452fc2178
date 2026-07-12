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

// مبنى 7 — مخطط رأسي viewBox 600x900، عمودين × 11 صف، 22 وحدة (مقاسة من building-7.svg)
const B7_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    // Left column top→bottom
    { unitNumber: 85, x: 36.10, y: 10.33, w: 10.70, h: 12.39 },
    { unitNumber: 84, x: 36.17, y: 23.11, w: 14.20, h: 6.03 },
    { unitNumber: 83, x: 36.17, y: 29.56, w: 14.39, h: 6.17 },
    { unitNumber: 82, x: 36.17, y: 35.95, w: 14.39, h: 6.13 },
    { unitNumber: 81, x: 36.17, y: 42.42, w: 14.51, h: 6.31 },
    { unitNumber: 80, x: 36.06, y: 48.98, w: 14.63, h: 6.10 },
    { unitNumber: 79, x: 36.17, y: 55.41, w: 14.51, h: 6.01 },
    { unitNumber: 78, x: 36.11, y: 61.75, w: 14.51, h: 6.26 },
    { unitNumber: 77, x: 36.12, y: 68.38, w: 14.51, h: 6.11 },
    { unitNumber: 76, x: 36.02, y: 74.74, w: 14.51, h: 6.10 },
    { unitNumber: 75, x: 35.67, y: 81.17, w: 11.12, h: 12.79 },
    // Right column top→bottom
    { unitNumber: 96, x: 54.20, y: 10.33, w: 10.68, h: 12.41 },
    { unitNumber: 95, x: 50.81, y: 23.11, w: 14.10, h: 6.05 },
    { unitNumber: 94, x: 50.90, y: 29.55, w: 13.98, h: 6.18 },
    { unitNumber: 93, x: 50.96, y: 35.95, w: 13.95, h: 6.13 },
    { unitNumber: 92, x: 50.96, y: 42.42, w: 14.20, h: 6.32 },
    { unitNumber: 91, x: 50.90, y: 48.98, w: 14.28, h: 6.10 },
    { unitNumber: 90, x: 50.84, y: 55.41, w: 14.40, h: 6.01 },
    { unitNumber: 89, x: 50.96, y: 61.75, w: 14.40, h: 6.26 },
    { unitNumber: 88, x: 50.76, y: 68.38, w: 14.65, h: 6.11 },
    { unitNumber: 87, x: 50.76, y: 74.74, w: 14.51, h: 6.10 },
    { unitNumber: 86, x: 54.31, y: 81.09, w: 10.85, h: 12.87 },
  ],
};

// مبنى 8 — مقاسة من building-8.svg
const B8_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    { unitNumber: 107, x: 39.80, y: 9.22, w: 11.04, h: 12.80 },
    { unitNumber: 106, x: 39.88, y: 22.41, w: 14.66, h: 6.23 },
    { unitNumber: 105, x: 39.88, y: 29.07, w: 14.86, h: 6.37 },
    { unitNumber: 104, x: 39.88, y: 35.67, w: 14.86, h: 6.33 },
    { unitNumber: 103, x: 39.88, y: 42.35, w: 14.98, h: 6.52 },
    { unitNumber: 102, x: 39.76, y: 49.12, w: 15.10, h: 6.30 },
    { unitNumber: 101, x: 39.88, y: 55.76, w: 14.98, h: 6.21 },
    { unitNumber: 100, x: 39.82, y: 62.31, w: 14.98, h: 6.47 },
    { unitNumber: 99,  x: 39.82, y: 69.15, w: 14.98, h: 6.31 },
    { unitNumber: 98,  x: 39.72, y: 75.72, w: 14.98, h: 6.30 },
    { unitNumber: 97,  x: 39.36, y: 82.37, w: 11.48, h: 13.21 },
    { unitNumber: 118, x: 58.50, y: 9.22, w: 11.03, h: 12.81 },
    { unitNumber: 117, x: 54.99, y: 22.41, w: 14.56, h: 6.25 },
    { unitNumber: 116, x: 55.08, y: 29.06, w: 14.44, h: 6.38 },
    { unitNumber: 115, x: 55.14, y: 35.67, w: 14.40, h: 6.33 },
    { unitNumber: 114, x: 55.14, y: 42.35, w: 14.66, h: 6.52 },
    { unitNumber: 113, x: 55.08, y: 49.12, w: 14.74, h: 6.30 },
    { unitNumber: 112, x: 55.02, y: 55.76, w: 14.86, h: 6.21 },
    { unitNumber: 111, x: 55.14, y: 62.31, w: 14.86, h: 6.47 },
    { unitNumber: 110, x: 55.06, y: 69.15, w: 15.13, h: 6.31 },
    { unitNumber: 109, x: 54.94, y: 75.72, w: 14.98, h: 6.30 },
    { unitNumber: 108, x: 58.61, y: 82.28, w: 11.20, h: 13.29 },
  ],
};

// مبنى 9 — مقاسة من building-9.svg
const B9_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    { unitNumber: 128, x: 36.74, y: 10.50, w: 11.31, h: 13.38 },
    { unitNumber: 127, x: 36.87, y: 24.13, w: 15.02, h: 6.72 },
    { unitNumber: 126, x: 36.87, y: 31.10, w: 15.02, h: 6.72 },
    { unitNumber: 125, x: 36.87, y: 38.06, w: 15.02, h: 6.72 },
    { unitNumber: 124, x: 36.87, y: 45.03, w: 15.02, h: 6.47 },
    { unitNumber: 123, x: 36.87, y: 51.75, w: 15.02, h: 6.47 },
    { unitNumber: 122, x: 36.87, y: 58.46, w: 15.02, h: 6.72 },
    { unitNumber: 121, x: 36.87, y: 65.43, w: 15.02, h: 6.72 },
    { unitNumber: 120, x: 36.87, y: 72.39, w: 15.02, h: 6.72 },
    { unitNumber: 119, x: 36.74, y: 79.29, w: 11.31, h: 13.38 },
    { unitNumber: 138, x: 56.03, y: 10.50, w: 11.31, h: 13.38 },
    { unitNumber: 137, x: 52.28, y: 24.15, w: 15.02, h: 6.72 },
    { unitNumber: 136, x: 52.29, y: 31.10, w: 15.02, h: 6.72 },
    { unitNumber: 135, x: 52.23, y: 38.06, w: 15.02, h: 6.72 },
    { unitNumber: 134, x: 52.17, y: 45.03, w: 15.02, h: 6.47 },
    { unitNumber: 133, x: 52.17, y: 51.75, w: 15.02, h: 6.47 },
    { unitNumber: 132, x: 52.17, y: 58.46, w: 15.02, h: 6.72 },
    { unitNumber: 131, x: 52.17, y: 65.43, w: 15.02, h: 6.72 },
    { unitNumber: 130, x: 52.17, y: 72.39, w: 15.02, h: 6.72 },
    { unitNumber: 129, x: 56.03, y: 79.29, w: 11.31, h: 13.38 },
  ],
};

// مبنى 10 — مقاسة من building-10.svg
const B10_LAYOUT: PlanLayout = {
  aspectRatio: 600 / 900,
  units: [
    { unitNumber: 148, x: 38.01, y: 10.62, w: 9.49,  h: 12.94 },
    { unitNumber: 147, x: 37.29, y: 23.80, w: 13.85, h: 6.38 },
    { unitNumber: 146, x: 37.29, y: 30.67, w: 13.85, h: 6.38 },
    { unitNumber: 145, x: 37.29, y: 37.26, w: 13.85, h: 6.38 },
    { unitNumber: 144, x: 37.29, y: 44.19, w: 13.85, h: 6.14 },
    { unitNumber: 143, x: 37.23, y: 50.84, w: 13.97, h: 6.33 },
    { unitNumber: 142, x: 37.29, y: 57.48, w: 13.85, h: 6.38 },
    { unitNumber: 141, x: 37.29, y: 64.18, w: 13.85, h: 6.38 },
    { unitNumber: 140, x: 37.29, y: 70.88, w: 13.85, h: 6.38 },
    { unitNumber: 139, x: 36.88, y: 77.73, w: 10.62, h: 13.16 },
    { unitNumber: 158, x: 55.07, y: 10.62, w: 9.71,  h: 12.95 },
    { unitNumber: 157, x: 51.51, y: 23.81, w: 13.91, h: 6.38 },
    { unitNumber: 156, x: 51.52, y: 30.66, w: 13.90, h: 6.38 },
    { unitNumber: 155, x: 51.46, y: 37.26, w: 13.96, h: 6.38 },
    { unitNumber: 154, x: 51.40, y: 44.19, w: 14.02, h: 6.14 },
    { unitNumber: 153, x: 51.46, y: 50.84, w: 13.63, h: 6.33 },
    { unitNumber: 152, x: 51.40, y: 57.48, w: 13.74, h: 6.38 },
    { unitNumber: 151, x: 51.40, y: 64.18, w: 13.74, h: 6.38 },
    { unitNumber: 150, x: 51.40, y: 70.88, w: 13.74, h: 6.38 },
    { unitNumber: 149, x: 55.07, y: 77.73, w: 10.36, h: 13.16 },
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
  9: B9_LAYOUT,
  10: B10_LAYOUT,
};

export function getPlanLayout(buildingNumber: number): PlanLayout | undefined {
  return BUILDING_PLANS[buildingNumber];
}
