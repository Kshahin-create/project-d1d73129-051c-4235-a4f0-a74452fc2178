import { describe, expect, it } from "vitest";
import { MASTER_PLAN_SPOTS, buildingBookingHref, masterPlanBuildingState } from "./masterPlan";
import { bookingRedirect } from "./bookingActivities";

describe("homepage master plan buttons", () => {
  it("has exactly one button for every building 1 to 35", () => {
    expect(MASTER_PLAN_SPOTS.map((s) => s.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1));
  });

  it("keeps every button inside the picture", () => {
    for (const s of MASTER_PLAN_SPOTS) {
      expect(s.x + s.w).toBeLessThanOrEqual(100);
      expect(s.y + s.h).toBeLessThanOrEqual(100);
    }
  });

  it("opens the tapped building on the booking page", () => {
    expect(buildingBookingHref("service", 4)).toBe("/booking?activity=service&building=4");
  });

  it("gives no link to a building that is closed or has no units", () => {
    expect(masterPlanBuildingState(21, [], []).href).toBeNull();
  });

  it("returns to the same building after sign-in", () => {
    expect(new URL(bookingRedirect("service", 4), "https://example.com").searchParams.get("redirect")).toBe("/booking?activity=service&building=4");
  });
});
