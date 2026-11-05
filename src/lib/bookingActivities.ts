// Activities, their buildings and unit restrictions come from the database registry
// (public_activities / public_building_activities / public_unit_activities).
// The seed below mirrors the registry's initial content and is used only until the
// registry has loaded (and in unit tests). applyActivityRegistry() replaces it in place.

export type BookingActivity = string;

export interface ActivityDef {
  key: string;
  short: string;
  title: string;
  description: string;
  marker: string;
  unitType?: string;
  riskClass?: "low" | "medium" | "high" | null;
  buildings: number[] | null;
}

const SEED: ActivityDef[] = [
  { key: "service", short: "صيانة السيارات", title: "ورش صيانة السيارات", description: "مباني 1 إلى 6 ومبنى 11", marker: "صيانة", buildings: [1, 2, 3, 4, 5, 6, 11] },
  { key: "parts", short: "قطع الغيار", title: "قطع غيار السيارات", description: "مباني 7 إلى 10 ومبنى 22", marker: "قطع غيار", buildings: [7, 8, 9, 10, 22] },
  { key: "batteries-decor", short: "بطاريات وزينة", title: "بطاريات وزينة السيارات", description: "على وحدات قطع الغيار — مباني 7 إلى 10", marker: "بطاريات", buildings: [7, 8, 9, 10] },
  { key: "tires", short: "البناشر والإطارات", title: "البناشر والإطارات", description: "مباني 7 إلى 10", marker: "بناشر", buildings: [7, 8, 9, 10] },
  { key: "car-wash", short: "مغاسل السيارات", title: "مغاسل السيارات", description: "على وحدات البناشر — مباني 7 إلى 10", marker: "مغسلة", buildings: [7, 8, 9, 10] },
  { key: "large-maintenance", short: "مراكز صيانة كبيرة", title: "مراكز صيانة السيارات الكبيرة", description: "على وحدات المعارض — مبنى 22", marker: "مركز صيانة", buildings: [22] },
  { key: "shops", short: "محلات تجارية", title: "المحلات التجارية والمعارض", description: "محلات ومعارض تجارية — مباني 12 و13 ومبنى 22", marker: "محل", buildings: [12, 13, 22] },
  { key: "car-showrooms", short: "معارض السيارات", title: "معارض السيارات", description: "معارض السيارات — مبنى 22", marker: "معرض سيارات", buildings: [22] },
  { key: "carpentry", short: "النجارة", title: "ورش النجارة", description: "ورش النجارة والأخشاب", marker: "نجارة", buildings: [14, 15, 16] },
  { key: "smithing", short: "الألمنيوم والحدادة", title: "ورش الألمنيوم والحدادة", description: "ورش الألمنيوم وأعمال الحدادة", marker: "حدادة", buildings: [17, 18, 19] },
  { key: "glass", short: "ورش الزجاج", title: "ورش الزجاج", description: "مباني 14 إلى 19", marker: "زجاج", buildings: [14, 15, 16, 17, 18, 19] },
  { key: "civil-defense", short: "الدفاع المدني", title: "أنشطة الدفاع المدني", description: "مباني 14 إلى 19", marker: "دفاع مدني", buildings: [14, 15, 16, 17, 18, 19] },
  { key: "warehouse-a", short: "مستودعات (أ)", title: "مستودعات متوسطة — مواد غير قابلة للاحتراق", description: "مباني 23 إلى 30 ومبنى 32", marker: "مستودع", riskClass: "low", buildings: [23, 24, 25, 26, 27, 28, 29, 30, 32] },
  { key: "warehouse-b", short: "مستودعات (ب)", title: "مستودعات متوسطة — ملابس وأثاث وورق", description: "مباني 31 و33 و34 و35", marker: "مستودع", riskClass: "medium", buildings: [31, 33, 34, 35] },
];

const SEED_RESTRICTED: Record<string, Record<number, number[]>> = {
  tires: { 7: [75, 85, 86, 96], 8: [97, 107, 108, 118], 9: [119, 128, 129, 138], 10: [139, 148, 149, 158] },
  "car-wash": { 7: [75, 85, 86, 96], 8: [97, 107, 108, 118], 9: [119, 128, 129, 138], 10: [139, 148, 149, 158] },
};

/** Live list of active activities (mutated in place when the registry loads). */
export const BOOKING_ACTIVITIES: ActivityDef[] = SEED.map((a) => ({ ...a }));
/** Activity code → building → unit numbers allowed. Activities without an entry allow every unit. */
const RESTRICTED_UNITS: Record<string, Record<number, number[]>> = structuredClone(SEED_RESTRICTED);

export const RISK_LABELS: Record<string, string> = { low: "خطورة منخفضة", medium: "خطورة متوسطة", high: "خطورة مرتفعة" };

export interface RegistryRows {
  activities: { code: string; name_ar: string; short_name: string | null; description: string | null; marker: string | null; unit_type: string | null; risk_class: string | null }[];
  buildingActivities: { building_number: number; activity_code: string }[];
  unitActivities: { building_number: number; unit_number: number; activity_code: string }[];
}

export function applyActivityRegistry(rows: RegistryRows): void {
  const byActivity = new Map<string, number[]>();
  for (const r of rows.buildingActivities) {
    const list = byActivity.get(r.activity_code) ?? [];
    if (!list.includes(r.building_number)) list.push(r.building_number);
    byActivity.set(r.activity_code, list);
  }
  const next: ActivityDef[] = rows.activities.map((a) => ({
    key: a.code,
    short: a.short_name || a.name_ar,
    title: a.name_ar,
    description: a.description ?? "",
    marker: a.marker ?? "",
    unitType: a.unit_type ?? undefined,
    riskClass: (a.risk_class as ActivityDef["riskClass"]) ?? null,
    buildings: (byActivity.get(a.code) ?? []).sort((x, y) => x - y),
  }));
  BOOKING_ACTIVITIES.splice(0, BOOKING_ACTIVITIES.length, ...next);
  for (const k of Object.keys(RESTRICTED_UNITS)) delete RESTRICTED_UNITS[k];
  for (const r of rows.unitActivities) {
    const byB = (RESTRICTED_UNITS[r.activity_code] ??= {});
    (byB[r.building_number] ??= []).push(r.unit_number);
  }
}

export function getActivity(key: string | null | undefined): ActivityDef | undefined {
  return BOOKING_ACTIVITIES.find((a) => a.key === key);
}

export function buildingInActivity(building: { number: number; type: string }, key: BookingActivity): boolean {
  const activity = getActivity(key);
  if (!activity) return false;
  if (activity.buildings) return activity.buildings.includes(building.number);
  return classifyBookingActivity(building.type) === key;
}

export function parseBookingActivity(value: string | null): BookingActivity | null {
  return getActivity(value)?.key ?? null;
}

export function classifyBookingActivity(value: string | null): BookingActivity | null {
  const text = value ?? "";
  if (/نجارة|أخشاب/.test(text)) return "carpentry";
  if (/حدادة|ألمنيوم|المنيوم/.test(text)) return "smithing";
  if (/صيانة/.test(text)) return "service";
  if (/قطع غيار|بنشر|بناشر|إطارات|اطارات/.test(text)) return "parts";
  return null;
}

export function bookingRedirect(activity: BookingActivity | null): string {
  const destination = `/booking${activity ? `?activity=${activity}` : ""}`;
  return `/auth?redirect=${encodeURIComponent(destination)}`;
}

export function countAvailableUnits(units: ReadonlyArray<{ status: string }>): number {
  return units.filter((unit) => unit.status === "available").length;
}

export function unitAllowedForActivity(
  unit: { buildingNumber: number; unitNumber: number },
  activity: BookingActivity | null | undefined,
): boolean {
  if (!activity) return true;
  const restricted = RESTRICTED_UNITS[activity];
  if (!restricted) return true;
  return restricted[unit.buildingNumber]?.includes(unit.unitNumber) ?? false;
}

export function countActivityAvailableUnits(
  units: ReadonlyArray<{ buildingNumber: number; unitNumber: number; status: string }>,
  activity: BookingActivity,
): number {
  return units.filter((unit) => unit.status === "available" && unitAllowedForActivity(unit, activity)).length;
}
