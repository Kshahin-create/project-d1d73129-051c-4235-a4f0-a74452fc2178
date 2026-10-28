import { describe, it, expect } from "vitest";
import { decodeCursor, encodeCursor, parseLimit, redact, hasCrmAccess } from "../../../supabase/functions/crm-api/logic";

describe("crm-api logic", () => {
  it("hides personal fields without crm:pii", () => {
    const r = redact({ full_name: "x", phone: "1", status: "a" }, ["crm:read"], ["full_name", "phone"], []);
    expect(r).toEqual({ full_name: null, phone: null, status: "a" });
  });
  it("hides money fields without crm:finance", () => {
    const r = redact({ paid_amount: 5, price: 9 }, ["crm:read", "crm:pii"], [], ["paid_amount"]);
    expect(r.paid_amount).toBeNull();
    expect(r.price).toBe(9);
  });
  it("keeps fields when scope granted", () => {
    const r = redact({ phone: "1" }, ["crm:read", "crm:pii"], ["phone"], []);
    expect(r.phone).toBe("1");
  });
  it("caps page size at 500", () => {
    expect(parseLimit("9999")).toBe(500);
    expect(parseLimit("abc")).toBe(100);
  });
  it("round-trips cursor and rejects garbage", () => {
    const c = { t: "2026-10-28T10:00:00.000Z", id: "11111111-1111-1111-1111-111111111111" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("not-a-cursor")).toBeNull();
  });
  it("old read/write/admin keys get no CRM access", () => {
    expect(hasCrmAccess(["read", "write", "admin"])).toBe(false);
  });
});
