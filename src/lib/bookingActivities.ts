export const BOOKING_ACTIVITIES = [
  { key: "service", title: "ورش صيانة السيارات", description: "مراكز وورش صيانة السيارات", marker: "صيانة" },
  { key: "parts", title: "قطع الغيار والبناشر", description: "محلات قطع الغيار وخدمات الإطارات", marker: "قطع غيار" },
  { key: "carpentry", title: "ورش النجارة", description: "ورش النجارة والأخشاب", marker: "نجارة" },
  { key: "smithing", title: "ورش الألمنيوم والحدادة", description: "ورش الألمنيوم وأعمال الحدادة", marker: "حدادة" },
] as const;

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