import { describe, it, expect } from "vitest";
import { UNIT_TRANSITIONS, validUnitTransition, legacyUnitStatus, bookingUnitState } from "./unitStatus";
describe("unit leasing transition policy", () => {
  for (const [from, allowed] of Object.entries(UNIT_TRANSITIONS)) {
    it(`enforces the exact allowed transitions from ${from}`, () => {
      for (const target of Object.keys(UNIT_TRANSITIONS)) {
        expect(validUnitTransition(from, target as keyof typeof UNIT_TRANSITIONS)).toBe(allowed.includes(target as keyof typeof UNIT_TRANSITIONS));
      }
    });
  }
  it("never turns an unresolved legacy state into available", () => {
    expect(legacyUnitStatus(null)).toBe("reserved");
    expect(legacyUnitStatus("unexpected")).toBe("reserved");
    expect(validUnitTransition(null, "available")).toBe(false);
  });
});

describe("public booking availability", () => {
  it.each([
    ["available", "available", true],
    ["on_hold", "reserved", false],
    ["pending_contract", "reserved", false],
    ["leased", "leased", false],
    ["maintenance", "unavailable", false],
    ["blocked", "unavailable", false],
  ] as const)("classifies %s from authoritative leasing state", (state, kind, selectable) => {
    expect(bookingUnitState(state)).toMatchObject({ state, kind, selectable });
  });
  it.each([null, undefined, "unexpected"])("never offers unresolved %s as available or confirmed reserved", (state) => {
    expect(bookingUnitState(state)).toMatchObject({ state: "review", kind: "unavailable", selectable: false });
  });
  it("locks activity-only restrictions without changing persisted occupancy", () => {
    expect(bookingUnitState("available", false)).toMatchObject({ kind: "reserved", selectable: false });
    expect(bookingUnitState("available", true)).toMatchObject({ state: "available", selectable: true });
  });
  it.each(["leased", "maintenance", "blocked", "pending_contract", null])("keeps actual %s state when activity is restricted", (state) => {
    expect(bookingUnitState(state, false)).toEqual(bookingUnitState(state, true));
  });
});