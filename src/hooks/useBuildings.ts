import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Building, Unit } from "@/data/types";

export const useBuildingsAndUnits = () => {
  return useQuery({
    queryKey: ["buildings-units"],
    queryFn: async (): Promise<{ buildings: Building[]; units: Unit[] }> => {
      const [bRes, uRes, tRes] = await Promise.all([
        supabase.from("buildings").select("*").order("number"),
        supabase.from("units").select("*").order("building_number").order("unit_number").limit(2000),
        supabase.from("tenants").select("*"),
      ]);
      // buildings may fail for unauthenticated users after RLS change —
      // fall back to deriving building info from public units data.
      if (uRes.error) throw uRes.error;
      if (tRes.error) throw tRes.error;

      const unitsRaw = uRes.data ?? [];
      const buildingsRaw = bRes.error ? [] : (bRes.data ?? []);
      const tenantsRaw = tRes.data ?? [];

      // Map tenants by unit_id for quick lookup
      const tenantByUnitId = new Map<string, { name: string; data: any }>();
      for (const t of tenantsRaw) {
        tenantByUnitId.set(t.unit_id, { name: t.tenant_name, data: t });
      }

      // Build units first so we can derive building stats from them if needed
      const units: Unit[] = unitsRaw.map((u) => {
        const tenantInfo = tenantByUnitId.get(u.id);
        const building = buildingsRaw.find((b) => b.number === u.building_number);
        return {
          buildingNumber: u.building_number,
          buildingType: building?.type ?? "",
          unitNumber: u.unit_number,
          unitType: u.unit_type,
          area: Number(u.area),
          activity: u.activity,
          price: Number(u.price),
          status: u.status as "available" | "rented" | "reserved",
          tenant: tenantInfo?.name ?? null,
        };
      });

      // If buildings query succeeded, use it directly.
      // Otherwise derive minimal building list from units (public data).
      let buildings: Building[];
      if (buildingsRaw.length > 0) {
        buildings = buildingsRaw.map((b) => {
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
      } else {
        const uniqueBuildingNumbers = [...new Set(unitsRaw.map((u) => u.building_number))].sort((a, b) => a - b);
        buildings = uniqueBuildingNumbers.map((bn) => {
          const bu = units.filter((u) => u.buildingNumber === bn);
          const rented = bu.filter((u) => u.status === "rented").length;
          // Derive building type from the activity of its units so the
          // service/parts filter still works for unauthenticated users.
          const activity = bu[0]?.activity ?? "";
          const derivedType = activity.includes("صيانة")
            ? "مراكز صيانة سيارات"
            : activity
              ? "محلات قطع غيار السيارات وبناشر"
              : "غير محدد";
          return {
            number: bn,
            type: derivedType,
            totalUnits: bu.length,
            rentedUnits: rented,
            availableUnits: bu.length - rented,
            expectedAnnualRevenue: 0,
          };
        });
        // Also patch units' buildingType so downstream UI shows the correct label.
        for (const u of units) {
          if (!u.buildingType) {
            const b = buildings.find((bb) => bb.number === u.buildingNumber);
            if (b) u.buildingType = b.type;
          }
        }
      }

      return { buildings, units };
    },
  });
};
