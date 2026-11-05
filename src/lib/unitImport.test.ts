import { describe, it, expect } from "vitest";
import { canSelect, defaultApprovedFields, guessMapping, mapRows, type PreviewRow } from "./unitImport";

const base: PreviewRow = { row: 2, kind: "changed", unit_id: "u", building_number: 1, unit_number: 5, activity_name: null, area_m2: 200, changes: [], conflicts: [] };

describe("unit import", () => {
  it("guesses Arabic headers", () => {
    const m = guessMapping(["رقم المبنى", "رقم الوحدة", "المساحة الكلية", "النشاط"]);
    expect(m.building_number).toBe("رقم المبنى");
    expect(m.unit_number).toBe("رقم الوحدة");
    expect(m.area_m2).toBe("المساحة الكلية");
    expect(m.activity).toBe("النشاط");
  });
  it("conflict rows can never be selected for apply", () => {
    expect(canSelect({ ...base, kind: "conflict", conflicts: ["المساحة ناقصة"] })).toBe(false);
    expect(canSelect({ ...base, kind: "unchanged" })).toBe(false);
    expect(canSelect({ ...base, kind: "new" })).toBe(true);
  });
  it("price changes are not approved by default", () => {
    const p = { ...base, changes: [{ field: "price", old: 1, new: 2 }, { field: "area_m2", old: 132, new: 200 }] };
    expect(defaultApprovedFields(p)).toEqual(["area_m2"]);
  });
  it("maps rows with spreadsheet row numbers", () => {
    expect(mapRows([{ A: " 7 " }], { building_number: "A" })[0]).toEqual({ row: 2, building_number: "7" });
  });
});
