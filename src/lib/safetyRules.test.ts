import { describe, expect, it } from "vitest";
import { controlCanSetStatus, isValidReason, reversalAmount } from "./safetyRules";

describe("archive reason", () => {
  it("requires at least 5 characters after trimming", () => {
    expect(isValidReason("خطأ")).toBe(false);
    expect(isValidReason("   abcd   ")).toBe(false);
    expect(isValidReason("مكرر بالخطأ")).toBe(true);
  });
});

describe("payment reversal", () => {
  it("creates the negative of the original amount", () => {
    expect(reversalAmount(35728)).toBe(-35728);
  });
});

describe("control role", () => {
  it("can put a unit into maintenance", () => {
    expect(controlCanSetStatus("available", "maintenance", null)).toBe(true);
  });
  it("can only return a unit to its previous status", () => {
    expect(controlCanSetStatus("maintenance", "rented", "rented")).toBe(true);
    expect(controlCanSetStatus("maintenance", "available", "rented")).toBe(false);
  });
  it("cannot set available, reserved or rented directly", () => {
    expect(controlCanSetStatus("reserved", "available", null)).toBe(false);
    expect(controlCanSetStatus("available", "reserved", null)).toBe(false);
    expect(controlCanSetStatus("available", "rented", null)).toBe(false);
  });
});
