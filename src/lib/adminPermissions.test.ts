import { describe, expect, it } from "vitest";
import { hasAdministrativeWriteAccess } from "../../supabase/functions/_shared/admin-permissions";

describe("administrative write permissions", () => {
  it("denies manager user deletion", () => {
    expect(hasAdministrativeWriteAccess(["manager"])).toBe(false);
  });
  it("denies manager booking and returning-customer changes even with a secondary role", () => {
    expect(hasAdministrativeWriteAccess(["manager", "user", "control"])).toBe(false);
  });
  it("preserves admin writes", () => {
    expect(hasAdministrativeWriteAccess(["admin"])).toBe(true);
    expect(hasAdministrativeWriteAccess(["admin", "manager"])).toBe(true);
  });
});