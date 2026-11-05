# Verification — unit leasing status

Applied migrations under `drizzle/migrations` are authoritative; files in this directory are implementation preparation references, not additional migrations to apply.

## Safe automated verification
From an authenticated admin client, invoke `unit_status_regression_tests` with no arguments. This tests real database functions inside an exception subtransaction, rolls back all fixtures and returns Boolean results. No test units, bookings, contracts, payments, roles or audit entries persist.

Checks: direct status write rejected; illegal transition rejected; control maintenance only; manager read-only; exactly 48-hour hold; duplicate booking rejected; second extension rejected; confirmation waits for contract; verified first payment required; manual leasing; contract termination releases; exact history count; fixture rollback.

Run project tests:
`bunx vitest run src/lib/unitStatus.test.ts src/lib/safetyRules.test.ts src/lib/dashboardMetrics.test.ts src/lib/ownerMetrics.test.ts src/lib/bookingActivities.test.ts src/lib/unitImport.test.ts`

Read-only database verification:
```sql
SELECT leasing_status, count(*) FROM public.units GROUP BY leasing_status;
SELECT count(*) FROM public.unit_status_backfill_review WHERE resolved_at IS NULL;
SELECT hold_hours, max_hold_extensions FROM public.app_settings WHERE id=1;
SELECT has_column_privilege('authenticated','public.units','status','UPDATE'),
       has_column_privilege('authenticated','public.units','leasing_status','UPDATE');
SELECT count(*) FROM public.units WHERE unit_number=2000000000;
SELECT jobname, schedule, active FROM cron.job WHERE command ILIKE '%expire_pending_bookings%';
```

## UI verification
1. `/admin` → تفاصيل الوحدة والعقد → سجل الحالات: paginated status timeline.
2. العقد: register linked contract, activate, verify an existing receipt, manually confirm leasing. Invalid/missing evidence is rejected.
3. `/admin/unit-status-review`: 70 unresolved historical reservations at migration time; never free them automatically. Review remains human-controlled.
4. `/control`: only available↔maintenance with a reason. Managers cannot mutate.
5. Assign separate leasing-manager role from `/admin/users`; `/leasing/holds` exposes only pending hold references and expiry, not client personal data. Extend with a reason once.

## Limits of verification
Actual simultaneous concurrent requests and actual cron execution timing were not exercised; row locks and SKIP LOCKED were inspected, sequential duplicate booking/extension rejection was tested. No permanent customer booking or live Telegram send was made. Existing API/MCP keys were not supplied, so their authenticated external flows were not end-to-end tested. Site was not published.