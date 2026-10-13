import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { DashboardUnit, CollectionRow, BookingRow, BookingUnitRow, TenantRow, InvoiceRow, AccountUnitRow } from '@/lib/dashboardMetrics';

type TableName = keyof Database['public']['Tables'];
// Read every permitted row without relying on API row caps. No RPC with side effects.
export async function readDashboardRows<T>(table: TableName, select = '*'): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const response = await supabase.from(table).select(select).order('id').range(offset, offset + 499);
    if (response.error) throw response.error;
    const batch = (response.data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export function useDashboardData(enabled: boolean, userId?: string) {
  const client = useQueryClient();
  const prefix = ['management-dashboard', userId];
  const options = { enabled, staleTime: 60_000, retry: 1 };
  const units = useQuery({ ...options, queryKey: [...prefix, 'units'], queryFn: () => readDashboardRows<DashboardUnit>('units', 'id, building_number, unit_number, status, price, area, activity, unit_type') });
  const buildings = useQuery({ ...options, queryKey: [...prefix, 'buildings'], queryFn: () => readDashboardRows<{ id: string; number: number; type: string }>('buildings', 'id, number, type') });
  const tenants = useQuery({ ...options, queryKey: [...prefix, 'tenants'], queryFn: () => readDashboardRows<TenantRow>('tenants', 'id, unit_id, tenant_name, business_name, phone, activity_type') });
  const collections = useQuery({ ...options, queryKey: [...prefix, 'unit_collections'], queryFn: () => readDashboardRows<CollectionRow>('unit_collections', 'id, unit_id, amount, is_archived, created_at') });
  const bookings = useQuery({ ...options, queryKey: [...prefix, 'bookings'], queryFn: () => readDashboardRows<BookingRow>('bookings', 'id, status, customer_full_name, offer_number, created_at, expires_at, user_id, units_count') });
  const bookingUnits = useQuery({ ...options, queryKey: [...prefix, 'booking_units'], queryFn: () => readDashboardRows<BookingUnitRow>('booking_units', 'id, booking_id, unit_id') });
  const invoices = useQuery({ ...options, queryKey: [...prefix, 'invoices'], queryFn: () => readDashboardRows<InvoiceRow>('invoices', 'id, unit_id, booking_id, tenant_account_id, due_date, paid, amount, paid_amount, invoice_number, customer_name') });
  const accountUnits = useQuery({ ...options, queryKey: [...prefix, 'tenant_account_units'], queryFn: () => readDashboardRows<AccountUnitRow>('tenant_account_units', 'id, tenant_account_id, unit_id') });
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`management-dashboard-${userId}`);
    for (const table of ['units', 'buildings', 'tenants', 'unit_collections', 'bookings', 'booking_units', 'invoices', 'tenant_account_units', 'unit_files', 'tenant_account_files']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void client.invalidateQueries({ queryKey: prefix });
        void client.invalidateQueries({ queryKey: ['dashboard-detail', userId] });
      });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, userId, client]);
  const queries = [units, buildings, tenants, collections, bookings, bookingUnits, invoices, accountUnits];
  const successfulTimes = queries.filter(q => q.isSuccess).map(q => q.dataUpdatedAt);
  return { units, buildings, tenants, collections, bookings, bookingUnits, invoices, accountUnits,
    refreshing: queries.some(q => q.isFetching),
    // Oldest successful dataset timestamp, not an optimistic clock on receive.
    updatedAt: successfulTimes.length ? Math.min(...successfulTimes) : 0,
    refresh: () => client.invalidateQueries({ queryKey: prefix }) };
}