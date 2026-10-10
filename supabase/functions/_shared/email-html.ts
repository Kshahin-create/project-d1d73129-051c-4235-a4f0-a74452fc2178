/** Preserve non-ASCII characters across email HTML transport and MIME encoders. */
export function encodeEmailHtml(html: string): string {
  return html.replace(/[^\x00-\x7F]/gu, (character) =>
    `&#${character.codePointAt(0)};`
  );
}

export interface EmailUnitArea {
  area?: number;
  totalArea?: number;
  buildingNumber?: number;
  buildingType?: string | null;
  activity?: string | null;
}

/** Use explicit total area first; workshop floor area is not its total area. */
export function getEmailUnitArea(unit: EmailUnitArea): number | undefined {
  if (typeof unit.totalArea === 'number' && Number.isFinite(unit.totalArea) && unit.totalArea > 0) {
    return unit.totalArea;
  }
  const description = `${unit.buildingType ?? ''} ${unit.activity ?? ''}`;
  const isWorkshop = /صيانة|ورشة|ورش/.test(description) ||
    (unit.buildingNumber !== undefined && unit.buildingNumber >= 1 && unit.buildingNumber <= 6);
  if (isWorkshop && typeof unit.area === 'number' && unit.area > 0 && unit.area <= 132) return 200;
  return unit.area;
}