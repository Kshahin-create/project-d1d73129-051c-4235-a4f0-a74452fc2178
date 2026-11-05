import { describe, it, expect } from "vitest";
import { isValidIdentity } from "./identity";

describe("identity validation", () => {
  it("commercial registration: 10 digits starting with 7", () => {
    expect(isValidIdentity("commercial_registration", "7012345678")).toBe(true);
    expect(isValidIdentity("commercial_registration", "701234567")).toBe(false); // 9 digits no longer accepted
    expect(isValidIdentity("commercial_registration", "1012345678")).toBe(false);
  });
  it("national ID: 10 digits starting with 1", () => {
    expect(isValidIdentity("national_id", "1012345678")).toBe(true);
    expect(isValidIdentity("national_id", "2012345678")).toBe(false);
  });
  it("iqama: 10 digits starting with 2", () => {
    expect(isValidIdentity("iqama", "2012345678")).toBe(true);
    expect(isValidIdentity("iqama", "20123456789")).toBe(false);
  });
  it("missing type is rejected", () => {
    expect(isValidIdentity(null, "7012345678")).toBe(false);
  });
});
