import { describe, expect, it } from "vitest";
import { CLOSE_REASON_LABELS, PARTY_STATUS_LABELS, phoneKey } from "./partyDirectory";
import { NO_ANSWER_AUTO_CLOSE_ATTEMPTS } from "./crm";

describe("customer duplicate key", () => {
  it("treats 05… and +966… as the same number", () => {
    expect(phoneKey("0551234567")).toBe("551234567");
    expect(phoneKey("+966 55 123 4567")).toBe(phoneKey("0551234567"));
    expect(phoneKey("966551234567")).toBe(phoneKey("0551234567"));
  });

  it("does not build a key from a too-short number", () => {
    expect(phoneKey("12345678")).toBeNull();
    expect(phoneKey("")).toBeNull();
  });
});

describe("customer types and closing", () => {
  it("has exactly the six computed customer types", () => {
    expect(Object.keys(PARTY_STATUS_LABELS).sort()).toEqual(["archived", "booker", "closed", "interested", "target", "tenant"]);
  });

  it("offers exactly the four closing reasons", () => {
    expect(Object.values(CLOSE_REASON_LABELS)).toEqual(["مش مهتم", "لا يرد", "غير مناسب", "اختار مكان تاني"]);
  });

  it("closes as no-answer after 10 recorded attempts", () => {
    expect(NO_ANSWER_AUTO_CLOSE_ATTEMPTS).toBe(10);
  });
});
