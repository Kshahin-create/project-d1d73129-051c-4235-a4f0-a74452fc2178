/**
 * إحداثيات الوحدات على صور مخططات المباني (نسبية بالنسبة المئوية).
 * كل وحدة تُعرّف بـ x, y (الزاوية العلوية اليسرى) و w, h (العرض والارتفاع).
 * النسب تكون من 0 إلى 100.
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

/**
 * Generic two-row layout (12 units per row) used across buildings 1–6.
 * topStart  → number of the LEFT-most unit in the top row.
 * botStart  → number of the LEFT-most unit in the bottom row.
 *
 * Row geometry can be tuned per-building if the image proportions differ.
 */
function buildTwoRowLayout(opts: {
  topStart: number;
  botStart: number;
  cols?: number;
  left?: number;
  right?: number;
  topY?: number;
  topH?: number;
  botY?: number;
  botH?: number;
  aspectRatio?: number;
}): PlanLayout {
  const {
    topStart,
    botStart,
    cols = 12,
    left = 3.2,
    right = 96.8,
    topY = 24.5,
    topH = 28.5,
    botY = 56.5,
    botH = 28.5,
    aspectRatio = 1920 / 1280,
  } = opts;

  const colWidth = (right - left) / cols;
  const units: PlanUnitArea[] = [];

  for (let i = 0; i < cols; i++) {
    units.push({
      unitNumber: topStart + i,
      x: left + i * colWidth,
      y: topY,
      w: colWidth,
      h: topH,
    });
  }
  for (let i = 0; i < cols; i++) {
    units.push({
      unitNumber: botStart + i,
      x: left + i * colWidth,
      y: botY,
      w: colWidth,
      h: botH,
    });
  }

  return { aspectRatio, units };
}

export const BUILDING_PLANS: Record<number, PlanLayout> = {
  // مبنى 1 — صف علوي 411→422، صف سفلي 399→410
  1: buildTwoRowLayout({ topStart: 411, botStart: 399 }),

  // مبنى 2 — صف علوي 363→374، صف سفلي 351→362
  2: buildTwoRowLayout({ topStart: 363, botStart: 351 }),

  // مبنى 3 — صف علوي 315→326، صف سفلي 303→314
  3: buildTwoRowLayout({ topStart: 315, botStart: 303 }),

  // مبنى 4 — صف علوي 267→278، صف سفلي 255→266
  4: buildTwoRowLayout({ topStart: 267, botStart: 255 }),

  // مبنى 5 — صف علوي 219→230، صف سفلي 207→218
  5: buildTwoRowLayout({ topStart: 219, botStart: 207 }),

  // مبنى 6 — صف علوي 171→182، صف سفلي 159→170
  6: buildTwoRowLayout({ topStart: 171, botStart: 159 }),
};

export function getPlanLayout(buildingNumber: number): PlanLayout | undefined {
  return BUILDING_PLANS[buildingNumber];
}
