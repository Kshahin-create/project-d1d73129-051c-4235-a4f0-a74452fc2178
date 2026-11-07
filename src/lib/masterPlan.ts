import { BOOKING_ACTIVITIES, buildingInActivity, countActivityAvailableUnits, type BookingActivity } from "@/lib/bookingActivities";

/**
 * Building positions on the full project master plan (homepage image, 1920×730).
 * Values are percentages of the image size so the buttons scale with it.
 */
export interface MasterPlanSpot { number: number; x: number; y: number; w: number; h: number }

export const MASTER_PLAN_SIZE = { width: 1920, height: 730 } as const;

export const MASTER_PLAN_SPOTS: MasterPlanSpot[] = [
  { number: 1, x: 8.49, y: 21.51, w: 13.65, h: 5.48 },
  { number: 2, x: 8.49, y: 30.0, w: 13.54, h: 5.21 },
  { number: 3, x: 8.59, y: 38.36, w: 13.54, h: 5.34 },
  { number: 4, x: 8.59, y: 46.44, w: 13.54, h: 5.48 },
  { number: 5, x: 8.59, y: 54.66, w: 13.65, h: 5.34 },
  { number: 6, x: 8.49, y: 62.88, w: 13.65, h: 5.21 },
  { number: 7, x: 3.18, y: 56.85, w: 1.67, h: 11.64 },
  { number: 8, x: 5.68, y: 56.85, w: 1.88, h: 11.64 },
  { number: 9, x: 3.33, y: 21.1, w: 1.61, h: 11.37 },
  { number: 10, x: 5.89, y: 21.1, w: 1.77, h: 11.37 },
  { number: 11, x: 3.49, y: 13.29, w: 21.77, h: 5.75 },
  { number: 12, x: 23.07, y: 21.1, w: 2.14, h: 47.26 },
  { number: 13, x: 26.61, y: 21.23, w: 2.19, h: 47.12 },
  { number: 14, x: 29.69, y: 62.6, w: 13.54, h: 5.48 },
  { number: 15, x: 29.69, y: 54.38, w: 13.54, h: 5.48 },
  { number: 16, x: 29.58, y: 46.16, w: 13.75, h: 5.75 },
  { number: 17, x: 29.69, y: 38.22, w: 13.54, h: 5.48 },
  { number: 18, x: 29.58, y: 30.0, w: 13.65, h: 5.48 },
  { number: 19, x: 29.79, y: 21.78, w: 13.54, h: 5.21 },
  { number: 20, x: 26.56, y: 13.01, w: 19.79, h: 5.75 },
  { number: 21, x: 3.49, y: 71.1, w: 21.61, h: 7.67 },
  { number: 22, x: 26.56, y: 71.1, w: 19.79, h: 7.67 },
  { number: 23, x: 44.01, y: 21.23, w: 2.34, h: 47.26 },
  { number: 24, x: 47.92, y: 12.6, w: 4.69, h: 57.53 },
  { number: 25, x: 53.65, y: 58.22, w: 16.15, h: 11.23 },
  { number: 26, x: 70.83, y: 58.22, w: 14.37, h: 11.23 },
  { number: 27, x: 53.65, y: 43.15, w: 16.15, h: 11.51 },
  { number: 28, x: 72.5, y: 43.15, w: 13.02, h: 11.51 },
  { number: 29, x: 53.65, y: 27.67, w: 16.25, h: 12.33 },
  { number: 30, x: 70.83, y: 27.67, w: 16.25, h: 12.33 },
  { number: 31, x: 53.65, y: 12.33, w: 42.45, h: 12.6 },
  { number: 32, x: 85.83, y: 29.73, w: 7.92, h: 43.15 },
  { number: 33, x: 47.81, y: 72.47, w: 41.51, h: 6.85 },
  { number: 34, x: 80.47, y: 81.78, w: 4.17, h: 6.85 },
  { number: 35, x: 84.27, y: 82.47, w: 3.85, h: 7.81 },
];

export type MasterPlanBuildingState = {
  number: number;
  /** Activity whose booking page opens for this building, or null when it can't be booked now. */
  activity: BookingActivity | null;
  activityTitle: string | null;
  available: number;
  href: string | null;
};

type BuildingLite = { number: number; type: string };
type UnitLite = { buildingNumber: number; unitNumber: number; status: string };

/** Booking link that opens the units of one building directly. */
export function buildingBookingHref(activity: BookingActivity, building: number): string {
  return `/booking?activity=${activity}&building=${building}`;
}

/**
 * Per-building button state. Buildings closed to booking or without units are not in `buildings`,
 * so they stay without a link. Available units respect activity-specific unit restrictions.
 */
export function masterPlanBuildingState(number: number, buildings: ReadonlyArray<BuildingLite>, units: ReadonlyArray<UnitLite>): MasterPlanBuildingState {
  const building = buildings.find((b) => b.number === number);
  if (!building) return { number, activity: null, activityTitle: null, available: 0, href: null };
  const buildingUnits = units.filter((u) => u.buildingNumber === number);
  let best: { key: BookingActivity; title: string; available: number } | null = null;
  for (const activity of BOOKING_ACTIVITIES) {
    if (!buildingInActivity(building, activity.key)) continue;
    const available = countActivityAvailableUnits(buildingUnits, activity.key);
    if (!best || available > best.available) best = { key: activity.key, title: activity.title, available };
  }
  if (!best) return { number, activity: null, activityTitle: null, available: 0, href: null };
  return { number, activity: best.key, activityTitle: best.title, available: best.available, href: buildingBookingHref(best.key, number) };
}
