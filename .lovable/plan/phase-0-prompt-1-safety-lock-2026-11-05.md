# Phase 0 / Prompt 1 — Safety lock

Goal: nothing in these 10 tables can be permanently deleted anymore; mistakes are fixed by archive, cancel, reversal or undo, and every action is logged. Nothing else changes.

## 1. Hard deletes found (to be replaced)

| Where | What it deletes | Replacement |
|---|---|---|
| Admin.tsx (release unit) | tenants row | `archive_tenant(id, reason)` |
| AdminLeads.tsx delete button | leads | `archive_record('leads', id, reason)` |
| AdminInterested.tsx delete button | interested_customers | `archive_record('interested_customers', ...)` |
| UnitCollectionsPanel.tsx delete | unit_collections | `reverse_collection(id, reason)` (reversal, see 2) |
| tenant-admin edge fn (delete account) | tenant_accounts | `archive_tenant_account(id, reason)` |
| telegram bot: delete_invoice | invoices | `reverse_payment(id, reason)` |
| telegram bot: delete_booking / remove units | bookings, booking_units | `cancel_booking_with_reason(id, reason)` / `remove_booking_units(..., reason)` |
| legacy api edge fn | tenants, tenant_account_units | archive / unlink functions |
| DB functions: admin_unlink_tenant_unit, admin_merge_tenant_accounts, merge_duplicate_tenant_accounts, auto_create_tenant_account, tenants_sync_account_trg | various | rewritten to archive instead of delete |

## 2. Database plan (one additive migration)

New columns (all nullable / defaulted, no drops or renames) on the 10 tables:
`archived_at`, `archived_by`, `archive_reason` (+ `is_archived` where missing; bookings use existing `status = 'cancelled'` + the same 3 columns).

Payments: `invoices` and `unit_collections` get `reverses_id` (link to original) and `reversal_reason`. A reversal = new negative row; the original stays untouched. Totals/paid amounts keep working because they already sum rows.

tenant_accounts: add `merged_into_id` (filled from existing `merged_into`), `merge_snapshot jsonb` (before data), `unmerged_at/by`.

New SECURITY DEFINER functions (admin only, reason min 5 chars, write audit_log, one transaction):
- `archive_record(table, id, reason)` / `unarchive_record(...)`
- `archive_tenant(...)`, `archive_tenant_account(...)`
- `cancel_booking_with_reason(...)`, `remove_booking_units(...)` (frees units only if no other tenant/booking — keeps current guard)
- `reverse_payment(invoice_id, reason)`, `reverse_collection(id, reason)`
- `admin_unmerge_tenant_accounts(account_id, reason)`

Permissions:
- `REVOKE DELETE` on all 10 tables from `authenticated` and `anon`.
- `REVOKE EXECUTE` on `admin_auto_merge_duplicate_tenants` and `merge_duplicate_tenant_accounts` from everyone except service_role.
- `admin_merge_tenant_accounts`: never deletes; sets `merged_into_id`, saves before/after to audit_log.
- Control role: trigger on `units` — a control user may only change status to or from `maintenance`; anything else is rejected by the database.

## 3. Booking expiry
Schedule `expire_pending_bookings()` with pg_cron every 5 minutes (288 runs/day, pure SQL, very light). Remove the call from AdminBookings.tsx page load.
Note: frequent checks keep the database awake and may slightly raise Cloud costs; 5 minutes is what you asked for, so I will keep it.

## 4. Screens (UI only)
- Leads, Interested, Tenant accounts, Collections, Bookings: delete buttons become "أرشفة" / "إلغاء" / "قيد عكسي" with a required reason box.
- "إظهار المؤرشف" toggle on those lists (archived hidden by default).
- Tenant accounts: remove the auto-merge button; add "تراجع عن الدمج" for admin on merged accounts.
- Admin.tsx release unit: archives the tenant with a reason.

## 5. Files touched
src/pages/Admin.tsx, AdminLeads.tsx, AdminInterested.tsx, AdminTenantAccounts.tsx, AdminBookings.tsx, src/components/dashboard/UnitCollectionsPanel.tsx, a small shared `ArchiveReasonDialog`, edge functions tenant-admin, telegram-bot-webhook, api. Tests: reason length, control-role rule, reversal sign.

## 6. Not touched
Developers/CRM API (read-only), executive dashboard, plan map, Telegram notifications. Dashboard queries get `archived_at is null` only where needed so totals stay the same.

## Verify after
1. Try deleting from any list → only archive with reason works; row shows under "إظهار المؤرشف".
2. Reverse a payment → negative row appears, totals drop, original unchanged.
3. Merge two accounts then "تراجع عن الدمج" → both back.
4. Control user: maintenance works, "available" is refused.
5. Pending booking past expiry turns expired within 5 minutes without opening any page.
