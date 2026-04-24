import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Building, Unit } from "@/data/types";

export const useBuildingsAndUnits = () => {
  return useQuery({
    queryKey: ["buildings-units"],
    queryFn: async (): Promise<{ buildings: Building[]; units: Unit[] }> => {
      const [bRes, uRes] = await Promise.all([
        supabase.from("buildings").select("*").order("number"),
        supabase.from("units").select("*").order("building_number").order("unit_number").limit(2000),
      ]);
      if (bRes.error) throw bRes.error;
      if (uRes.error) throw uRes.error;

      const unitsRaw = uRes.data ?? [];
      const buildingsRaw = bRes.data ?? [];

      const units: Unit[] = unitsRaw.map((u) => ({
        buildingNumber: u.building_number,
        buildingType: buildingsRaw.find((b) => b.number === u.building_number)?.type ?? "",
        unitNumber: u.unit_number,
        unitType: u.unit_type,
        area: Number(u.area),
        activity: u.activity,
        price: Number(u.price),
        status: u.status as "available" | "rented",
        tenant: null,
      }));

      const buildings: Building[] = buildingsRaw.map((b) => {
        const bu = units.filter((u) => u.buildingNumber === b.number);
        const rented = bu.filter((u) => u.status === "rented").length;
        return {
          number: b.number,
          type: b.type,
          totalUnits: bu.length,
          rentedUnits: rented,
          availableUnits: bu.length - rented,
          expectedAnnualRevenue: Number(b.expected_annual_revenue),
        };
      });

      return { buildings, units };
    },
  });
};
