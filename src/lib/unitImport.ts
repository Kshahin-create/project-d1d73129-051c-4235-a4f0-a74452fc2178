export type ImportField = "building_number" | "unit_number" | "unit_type" | "activity" | "area_m2" | "price";

export const IMPORT_FIELDS: { key: ImportField; label: string; required: boolean; hints: RegExp }[] = [
  { key: "building_number", label: "رقم المبنى", required: true, hints: /مبنى|المبنى|building/i },
  { key: "unit_number", label: "رقم الوحدة", required: true, hints: /وحدة|الوحدة|unit.?(no|number|#)?$|^unit/i },
  { key: "unit_type", label: "نوع الوحدة", required: false, hints: /نوع|type/i },
  { key: "activity", label: "النشاط", required: false, hints: /نشاط|activity/i },
  { key: "area_m2", label: "المساحة م²", required: true, hints: /مساح|area/i },
  { key: "price", label: "السعر السنوي", required: false, hints: /سعر|ايجار|إيجار|price|rent/i },
];

/** Guess which file column maps to each import field from header names. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();
  for (const f of IMPORT_FIELDS) {
    const h = headers.find((x) => !used.has(x) && f.hints.test(x.trim()));
    if (h) { out[f.key] = h; used.add(h); }
  }
  return out;
}

export type ImportRow = Partial<Record<ImportField, string>> & { row: number };

export function mapRows(raw: Record<string, unknown>[], mapping: Partial<Record<ImportField, string>>): ImportRow[] {
  return raw.map((r, i) => {
    const o: ImportRow = { row: i + 2 };
    for (const f of IMPORT_FIELDS) {
      const col = mapping[f.key];
      if (col) o[f.key] = String(r[col] ?? "").trim();
    }
    return o;
  });
}

export interface PreviewRow {
  row: number;
  kind: "new" | "changed" | "unchanged" | "conflict";
  unit_id: string | null;
  building_number: number | null;
  unit_number: number | null;
  activity_name: string | null;
  area_m2: number | null;
  changes: { field: string; old: unknown; new: unknown }[];
  conflicts: string[];
}

/** Price changes are opt-in; every other changed field is pre-approved. */
export function defaultApprovedFields(p: PreviewRow): string[] {
  return p.changes.map((c) => c.field).filter((f) => f !== "price");
}

export function canSelect(p: PreviewRow): boolean {
  return p.kind === "new" || p.kind === "changed";
}
