import { describe, expect, it } from "vitest";
import { CHECK_CODES, CHECK_META, findingHref } from "./dataQuality";

describe("data quality checks metadata", () => {
  it("covers exactly the eight approved checks", () => {
    expect(CHECK_CODES.sort()).toEqual([
      "collections_receipts_mismatch",
      "contract_without_installments",
      "duplicate_parties_unreviewed",
      "hold_expired",
      "leased_without_contract",
      "party_on_available_unit",
      "published_unit_incomplete",
      "receipt_missing_proof_or_allocation",
    ]);
  });

  it("every check has an Arabic title and description", () => {
    for (const code of CHECK_CODES) {
      expect(CHECK_META[code].title.length).toBeGreaterThan(3);
      expect(CHECK_META[code].description.length).toBeGreaterThan(10);
    }
  });

  it("links findings to their record pages", () => {
    expect(findingHref({ entity_table: "units", entity_id: "u1" })).toBe("/admin/units/u1");
    expect(findingHref({ entity_table: "contracts", entity_id: "c1" })).toBe("/admin/contracts/c1");
    expect(findingHref({ entity_table: "receipts", entity_id: "r1" })).toBe("/admin/receipts/r1");
    expect(findingHref({ entity_table: "duplicate_candidates", entity_id: "d1" })).toBe("/admin/parties");
    expect(findingHref({ entity_table: "finance", entity_id: "totals" })).toBe("/admin/receipt-reconciliation");
    expect(findingHref({ entity_table: "unknown", entity_id: "x" })).toBeNull();
  });
});
