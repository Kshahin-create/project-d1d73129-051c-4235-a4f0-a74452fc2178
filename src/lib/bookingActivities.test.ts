import { describe, expect, it } from "vitest";
import { bookingRedirect, classifyBookingActivity, countAvailableUnits, parseBookingActivity, unitAllowedForActivity, countActivityAvailableUnits } from "./bookingActivities";

describe("booking activity scopes", () => {
  it("offers independent carpentry and smithing scopes", () => {
    expect(parseBookingActivity("carpentry")).toBe("carpentry");
    expect(parseBookingActivity("smithing")).toBe("smithing");
    expect(classifyBookingActivity("ورش نجارة وأخشاب")).toBe("carpentry");
    expect(classifyBookingActivity("ورش الألمنيوم والحدادة")).toBe("smithing");
  });
  it("does not classify unknown buildings as spare parts", () => {
    expect(classifyBookingActivity("معارض")).toBeNull();
    expect(parseBookingActivity("unknown")).toBeNull();
  });
  it("preserves the selected activity through sign-in", () => {
    expect(new URL(bookingRedirect("smithing"), "https://example.com").searchParams.get("redirect")).toBe("/booking?activity=smithing");
  });
  it("counts only explicitly available units", () => {
    expect(countAvailableUnits([{ status: "available" }, { status: "maintenance" }, { status: "booked" }, { status: "rented" }, { status: "reserved" }])).toBe(1);
  });
});
import { buildingInActivity } from "./bookingActivities";
describe("owner activity-to-building mapping", () => {
  it("offers car showrooms only in building 22 while 21 is closed without replacing commercial shops", () => {
    expect(parseBookingActivity("car-showrooms")).toBe("car-showrooms");
    expect([12, 13, 21, 22].filter(number => buildingInActivity({ number, type: "" }, "car-showrooms"))).toEqual([22]);
    expect([12, 13, 21, 22].filter(number => buildingInActivity({ number, type: "" }, "shops"))).toEqual([12, 13, 22]);
  });
  it("maps buildings per the owner list", () => {
    expect(buildingInActivity({ number: 11, type: "" }, "service")).toBe(true);
    expect(buildingInActivity({ number: 7, type: "" }, "service")).toBe(false);
    expect(buildingInActivity({ number: 12, type: "" }, "parts")).toBe(true);
    expect(buildingInActivity({ number: 12, type: "" }, "shops")).toBe(true);
    expect(buildingInActivity({ number: 21, type: "" }, "shops")).toBe(false);
    expect(parseBookingActivity("food")).toBeNull();
    expect(buildingInActivity({ number: 9, type: "" }, "tires")).toBe(true);
    expect(buildingInActivity({ number: 32, type: "" }, "warehouse-a")).toBe(true);
    expect(buildingInActivity({ number: 31, type: "" }, "warehouse-b")).toBe(true);
    expect(buildingInActivity({ number: 14, type: "ورش نجارة" }, "carpentry")).toBe(true);
  });
  it("adds the owner's alternative activities on their buildings", () => {
    expect([7, 10, 12].filter(n => buildingInActivity({ number: n, type: "" }, "car-wash"))).toEqual([7, 10]);
    expect([7, 12, 13, 14].filter(n => buildingInActivity({ number: n, type: "" }, "restaurants"))).toEqual([12, 13]);
    expect([13, 14, 19, 20].filter(n => buildingInActivity({ number: n, type: "" }, "glass"))).toEqual([14, 19]);
  });
});

describe("red tyre and car-wash units", () => {
  const expected = { 7: [75, 85, 86, 96], 8: [97, 107, 108, 118], 9: [119, 128, 129, 138], 10: [139, 148, 149, 158] };
  it.each(["tires", "car-wash"] as const)("allows only red units for %s in buildings 7–10", (activity) => {
    for (const [building, numbers] of Object.entries(expected)) {
      const buildingNumber = Number(building);
      const allNumbers = Array.from({ length: buildingNumber < 9 ? 22 : 20 }, (_, i) => numbers[0] + i);
      expect(allNumbers.filter(unitNumber => unitAllowedForActivity({ buildingNumber, unitNumber }, activity))).toEqual(numbers);
    }
    expect(unitAllowedForActivity({ buildingNumber: 11, unitNumber: 139 }, activity)).toBe(false);
  });
  it("keeps existing rented and reserved red units unavailable", () => {
    expect(countActivityAvailableUnits([
      { buildingNumber: 7, unitNumber: 75, status: "rented" },
      { buildingNumber: 7, unitNumber: 85, status: "available" },
      { buildingNumber: 7, unitNumber: 86, status: "reserved" },
      { buildingNumber: 7, unitNumber: 87, status: "available" },
    ], "car-wash")).toBe(1);
  });
  it("does not reserve spare-parts units for other activities", () => {
    expect(unitAllowedForActivity({ buildingNumber: 7, unitNumber: 87 }, "parts")).toBe(true);
    expect(unitAllowedForActivity({ buildingNumber: 7, unitNumber: 87 }, null)).toBe(true);
  });
});
