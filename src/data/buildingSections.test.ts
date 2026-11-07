import { describe, expect, it } from "vitest";
import { getBuildingSections, EXTRA_SECTIONS } from "@/data/buildingPlans";
import { getBuildingLocationImages } from "@/components/BuildingLocationPreview";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("building sections (أ / ب)", () => {
  it("splits building 1 into 1-أ (399–422) and 1-ب (423–446)", () => {
    const sections = getBuildingSections(1, range(399, 446));
    expect(sections.map((s) => s.key)).toEqual(["a", "b"]);
    expect(sections[0].unitNumbers).toEqual(range(399, 422));
    expect(sections[1].unitNumbers).toEqual(range(423, 446));
  });

  it("places 1-ب rows as on the owner's plan: top 435–446, bottom 423–434", () => {
    const units = EXTRA_SECTIONS[1][0].layout.units;
    const top = units.filter((u) => u.y < 40).map((u) => u.unitNumber);
    const bottom = units.filter((u) => u.y > 40).map((u) => u.unitNumber);
    expect(top).toEqual(range(435, 446));
    expect(bottom).toEqual(range(423, 434));
  });

  it("shows only the chosen part's location image", () => {
    expect(getBuildingLocationImages(1, "a").map((i) => i.label)).toEqual(["مبنى ١ — أ"]);
    expect(getBuildingLocationImages(1, "b").map((i) => i.label)).toEqual(["مبنى ١ — ب"]);
  });

  it("opens a building directly when only one section has units", () => {
    expect(getBuildingSections(1, range(399, 422))).toHaveLength(1);
    expect(getBuildingSections(7, range(75, 96))).toHaveLength(1);
  });
});
