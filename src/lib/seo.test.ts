import { describe, expect, it } from "vitest";
import { pageSeo, PUBLIC_PAGES, SITE_SCHEMA } from "./seo";

describe("public search discovery", () => {
  it("uses ejar as the canonical origin", () => {
    expect(pageSeo("/").canonical).toBe("https://ejar.mnicity.com/");
    expect(pageSeo("/how-to-book").canonical).toBe("https://ejar.mnicity.com/how-to-book");
  });
  it.each(["/admin", "/admin/bookings", "/profile", "/dashboard", "/invoice/123", "/tenant-login/token", "/auth", "/booking", "/unknown"])("excludes private, session and unknown paths: %s", (path) => {
    expect(pageSeo(path).indexable).toBe(false);
    expect(pageSeo(path).canonical).toBeUndefined();
    expect(PUBLIC_PAGES.some((page) => page.path === path)).toBe(false);
  });
  it("does not invent rental offers, opening hours or coordinates", () => {
    const schema = JSON.stringify(SITE_SCHEMA);
    expect(schema).not.toMatch(/"(?:offers|openingHours|latitude|longitude)"/);
    expect(SITE_SCHEMA["@graph"][0].url).toBe("https://mnicity.com/");
  });
});