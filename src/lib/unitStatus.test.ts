import { describe, it, expect } from "vitest";
import { UNIT_TRANSITIONS, validUnitTransition, legacyUnitStatus } from "./unitStatus";
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