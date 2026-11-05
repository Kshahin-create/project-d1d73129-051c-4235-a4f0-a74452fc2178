// buildings: explicit building numbers for the activity (owner-provided mapping); null = classify by building type.
export const BOOKING_ACTIVITIES = [
  { key: "service", short: "صيانة السيارات", title: "ورش صيانة السيارات", description: "مباني 1 إلى 6 ومبنى 11", marker: "صيانة", buildings: [1, 2, 3, 4, 5, 6, 11] },
  { key: "parts", short: "قطع الغيار", title: "قطع غيار وبطاريات وزينة سيارات", description: "مباني 7 إلى 10 ومبنى 12 (جهة الورش)", marker: "قطع غيار", buildings: [7, 8, 9, 10, 12] },
  { key: "tires", short: "بناشر ومغاسل", title: "بناشر ومغاسل", description: "مباني 7 إلى 10", marker: "بناشر", buildings: [7, 8, 9, 10] },
  { key: "shops", short: "محلات تجارية", title: "المحلات التجارية والمعارض", description: "محلات ومعارض تجارية — مباني 12 و13 ومبنى 22", marker: "محل", buildings: [12, 13, 22] },
  { key: "car-showrooms", short: "معارض السيارات", title: "معارض السيارات", description: "معارض السيارات — مبنى 22", marker: "معرض سيارات", buildings: [22] },
  { key: "carpentry", short: "النجارة", title: "ورش النجارة", description: "ورش النجارة والأخشاب", marker: "نجارة", buildings: null },
  { key: "smithing", short: "الألمنيوم والحدادة", title: "ورش الألمنيوم والحدادة", description: "ورش الألمنيوم وأعمال الحدادة", marker: "حدادة", buildings: null },
  { key: "warehouse-a", short: "مستودعات (أ)", title: "مستودعات متوسطة — مواد غير قابلة للاحتراق", description: "سيراميك وبورسلان، أدوات صحية، مواد بناء (أسمنت، جبس، حجر، رخام)، حديد وألومنيوم، زجاج ومرايا، قطع غيار صناعية معدنية، محركات كهربائية، أثاث وخزائن معدنية، أوانٍ معدنية وخزفية — مباني 23 إلى 30 ومبنى 32", marker: "مستودع", buildings: [23, 24, 25, 26, 27, 28, 29, 30, 32] },
  { key: "warehouse-b", short: "مستودعات (ب)", title: "مستودعات متوسطة — ملابس وأثاث وورق", description: "ملابس ومنسوجات، أثاث خشبي ومنجّد، مفروشات وسجاد ومراتب، أخشاب، ورق وكرتون وكتب، مواد تغليف، حقائب وجلديات، إطارات مركبات، منتجات بلاستيكية — مباني 31 و33 و34 و35", marker: "مستودع", buildings: [31, 33, 34, 35] },
] as const;

export function buildingInActivity(building: { number: number; type: string }, key: BookingActivity): boolean {
  const activity = BOOKING_ACTIVITIES.find((a) => a.key === key);
  if (!activity) return false;
  if (activity.buildings) return (activity.buildings as readonly number[]).includes(building.number);
  return classifyBookingActivity(building.type) === key;
}

export type BookingActivity = typeof BOOKING_ACTIVITIES[number]["key"];

export function parseBookingActivity(value: string | null): BookingActivity | null {
  return BOOKING_ACTIVITIES.find((activity) => activity.key === value)?.key ?? null;
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