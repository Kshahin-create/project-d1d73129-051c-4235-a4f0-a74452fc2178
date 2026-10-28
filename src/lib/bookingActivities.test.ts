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