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
  aspectRatio: 1600 / 1066,
  topY: 33.02, topH: 11.73,
  botY: 52.53, botH: 11.44,
  columns: [
    [1.12, 10.06], [10.06, 18.00], [18.00, 25.94], [25.94, 33.88],
    [33.88, 41.81], [41.81, 49.81], [49.81, 57.75], [57.75, 65.75],
    [65.75, 73.69], [73.69, 81.62], [81.62, 89.56], [89.56, 98.69],
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
};

export function getPlanLayout(buildingNumber: number): PlanLayout | undefined {
  return BUILDING_PLANS[buildingNumber];
}
