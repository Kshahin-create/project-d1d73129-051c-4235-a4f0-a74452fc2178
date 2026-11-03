import { describe, expect, it } from "vitest";
import { bookingRedirect, classifyBookingActivity, countAvailableUnits, parseBookingActivity } from "./bookingActivities";

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
  it("maps buildings per the owner list", () => {
    expect(buildingInActivity({ number: 11, type: "" }, "service")).toBe(true);
    expect(buildingInActivity({ number: 7, type: "" }, "service")).toBe(false);
    expect(buildingInActivity({ number: 12, type: "" }, "parts")).toBe(true);
    expect(buildingInActivity({ number: 12, type: "" }, "food")).toBe(true);
    expect(buildingInActivity({ number: 9, type: "" }, "tires")).toBe(true);
    expect(buildingInActivity({ number: 32, type: "" }, "warehouse-a")).toBe(true);
    expect(buildingInActivity({ number: 31, type: "" }, "warehouse-b")).toBe(true);
    expect(buildingInActivity({ number: 14, type: "ورش نجارة" }, "carpentry")).toBe(true);
  });
});
