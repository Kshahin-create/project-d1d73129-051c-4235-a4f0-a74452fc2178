import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Building, Unit } from "@/data/types";
import { applyActivityRegistry, countAvailableUnits } from "@/lib/bookingActivities";
import { useAuth } from "@/hooks/useAuth";

export const useBuildingsAndUnits = () => {
  const { isAdmin, isManager } = useAuth();
  const canReadPeople = isAdmin || isManager;
  return useQuery({
    queryKey: ["buildings-units", canReadPeople],
    queryFn: async (): Promise<{ buildings: Building[]; units: Unit[] }> => {
      // Public site reads only the registry's public views: published, non-test units in published buildings.
      const [bRes, uRes, tRes, buRes, aRes, baRes, uaRes] = await Promise.all([
        supabase.from("public_buildings").select("*").order("number"),
        supabase.from("public_units").select("*").order("building_number").order("unit_number").limit(5000),
        canReadPeople ? supabase.from("tenants").select("*").is("archived_at", null) : Promise.resolve({ data: [], error: null }),
        canReadPeople ? supabase
          .from("booking_units")
          .select("unit_id, bookings:booking_id(customer_full_name, status, created_at)")
          .is("archived_at", null).limit(5000) : Promise.resolve({ data: [], error: null }),
        supabase.from("public_activities").select("*").order("sort_order"),
        supabase.from("public_building_activities").select("*"),
        supabase.from("public_unit_activities").select("*"),
      ]);
      if (aRes.error) throw aRes.error;
      if (baRes.error) throw baRes.error;
      if (uaRes.error) throw uaRes.error;
      applyActivityRegistry({
        activities: (aRes.data ?? []) as any,
        buildingActivities: (baRes.data ?? []) as any,
        unitActivities: (uaRes.data ?? []) as any,
      });
      // buildings may fail for unauthenticated users after RLS change —
      // fall back to deriving building info from public units data.
      if (uRes.error) throw uRes.error;
      if (tRes.error) throw tRes.error;
      if (bRes.error) throw bRes.error;

      const buildingsRaw = (bRes.data ?? []) as { number: number; type: string; booking_enabled: boolean; expected_annual_revenue: number }[];

      // Buildings closed to booking (booking_enabled = false) are hidden from
      // the public booking flow entirely; the database still rejects their
      // units inside create_booking as a second guard.
      const disabledBuildingNumbers = new Set(
        buildingsRaw.filter((b) => b.booking_enabled === false).map((b) => b.number),
      );
      const unitsRaw = ((uRes.data ?? []) as any[]).filter((u) => !disabledBuildingNumbers.has(u.building_number));
      const tenantsRaw = tRes.data ?? [];
      const bookingUnitsRaw = (buRes.error ? [] : (buRes.data ?? [])) as any[];

      // Map tenants by unit_id for quick lookup
      const tenantByUnitId = new Map<string, { name: string; data: any }>();
      for (const t of tenantsRaw) {
        tenantByUnitId.set(t.unit_id, { name: t.tenant_name, data: t });
      }

      // Fallback: pick latest active (pending/confirmed) booking customer per unit
      const bookingNameByUnitId = new Map<string, { name: string; ts: number }>();
      for (const bu of bookingUnitsRaw) {
        const b = bu.bookings;
        if (!b || !bu.unit_id) continue;
        if (b.status !== "pending" && b.status !== "confirmed") continue;
        const ts = b.created_at ? new Date(b.created_at).getTime() : 0;
        const prev = bookingNameByUnitId.get(bu.unit_id);
        if (!prev || ts > prev.ts) {
          bookingNameByUnitId.set(bu.unit_id, { name: b.customer_full_name, ts });
        }
      }

      // Build units first so we can derive building stats from them if needed
      const units: Unit[] = unitsRaw.map((u) => {
        const tenantInfo = tenantByUnitId.get(u.id);
        const building = buildingsRaw.find((b) => b.number === u.building_number);
        return {
          id: u.id,
          buildingNumber: u.building_number,
          buildingType: building?.type ?? "",
          unitNumber: u.unit_number,
          unitType: u.unit_type,
          area: Number(u.area),
          activity: u.activity,
          price: Number(u.price),
          status: u.status as "available" | "rented" | "reserved",
          leasingStatus: u.leasing_status,
          tenant: tenantInfo?.name ?? bookingNameByUnitId.get(u.id)?.name ?? null,
        };
      });

      const unitBuildingNumbers = new Set(units.map((u) => u.buildingNumber));
      const buildings: Building[] = buildingsRaw
        .filter((b) => !disabledBuildingNumbers.has(b.number) && unitBuildingNumbers.has(b.number))
        .map((b) => {
          const bu = units.filter((u) => u.buildingNumber === b.number);
          return {
            number: b.number,
            type: b.type,
            totalUnits: bu.length,
            rentedUnits: bu.filter((u) => u.status === "rented").length,
            availableUnits: countAvailableUnits(bu),
            expectedAnnualRevenue: Number(b.expected_annual_revenue),
          };
        });

      return { buildings, units };
    },
  });
};
