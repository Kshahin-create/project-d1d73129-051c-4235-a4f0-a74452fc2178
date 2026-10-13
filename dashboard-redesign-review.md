# Dashboard redesign review

## Changed files
- `src/pages/Dashboard.tsx`: Arabic RTL management workspace, six interactive KPIs, shared building/activity/status/search scope, real-date period filters, buildings comparison, paginated units/tenant-records/collections, follow-up and secondary analytics.
- `src/hooks/useDashboardData.ts`: user-scoped, permission-gated paginated reads; independent error states; realtime invalidation, periodic refresh and successful-read timestamp.
- `src/lib/dashboardMetrics.ts` and `.test.ts`: pure status, financial, filter, date and obligation calculations with regression coverage.
- `src/components/dashboard/ManagementMap.tsx`: existing master plan and measured building coordinates, current-status overlays and selectable unit grid.
- `src/components/dashboard/ManagementUnitDetails.tsx`: read-only real bookings, tenant records, collections and signed file access.
- `src/index.css`: scoped light petrol/gold workspace and reduced-motion handling.
- `src/App.tsx`: hides floating marketing contact on `/dashboard` only; sidebar and public routes unchanged.
- `AGENTS.md`, `roadmap.md`: engineering decisions and completion status.
- `src/integrations/supabase/types.ts`: automatically generated type declarations also changed during the earlier work and should have been listed. The latest file-specific commit (`e7c2f6e`, 2026-10-13 23:13 UTC) removes 26 lines describing five legacy email-queue functions: `delete_email`, `email_queue_dispatch`, `enqueue_email`, `move_to_dlq`, `read_email_batch`. These correspond to the preceding email-sending upgrade, not dashboard data reads. Git verifies the removed declarations, but does not independently establish which platform process regenerated them. The file describes the backend; changing declarations does not run a migration. It was not manually edited or regenerated in this follow-up, and no schema migration was created or executed for either dashboard review.

## Follow-up changes
- `src/pages/Dashboard.tsx`: business Arabic status labels, toolbar exports for the active buildings/units/tenant-records/collections tab, complete filtered sets, availability gates, degraded tenant-search warning and immediately clamped pagination after dataset shrink.
- `src/lib/dashboardExport.ts`: dashboard-only row projections with translated columns and distinct annual versus period cash figures.
- `src/lib/exportData.ts`: optional separate report-scope metadata worksheet; existing callers remain unchanged and downloads stay local.
- `src/lib/dashboardMetrics.ts` and `.test.ts`: shared Arabic labels and pagination clamp, plus export/status/pagination regression tests.
- `src/components/dashboard/ManagementUnitDetails.tsx`: unknown booking states no longer leak English codes.

## Checks
- Vitest follow-up: all 14 tests passed across 3 files, including nine dashboard aggregate/filter/period/obligation/status/pagination/export tests.
- Authenticated Chromium preview: desktop 1280×1800 and mobile 390×844 inspected; no runtime errors or mobile horizontal overflow.
- Verified actual all-period collections, building selection, KPI drilldown, maintenance empty state, actual dated invoice follow-up and read-only unit details.
- Build/typecheck are managed automatically by Lovable; no manual build or typecheck was run.
- Dashboard-specific modules contain no inserts, updates, deletes, schema operations or side-effect RPCs; no publishing performed.
- Follow-up authenticated browser checks: downloaded and opened Excel files for all 228 units, 101 tenant records, 36 nonarchived collections, 10 buildings and 24 building-filtered units. Counts are observed test-time data, not hardcoded application totals. Verified Arabic columns, scope worksheet and complete unpaginated sets.
- Simulated a read-response shrink to five units, without changing stored records: pagination immediately returned to page one. Simulated failed tenant reads: visible incomplete-search warning and disabled export. No runtime exceptions; desktop/mobile screenshots inspected.
- Final automatic build/typecheck after the export typing correction: `build OK` at 2026-10-13 23:26:52 UTC.

## Reporting limitations
- Collection period uses the real `created_at` registration timestamp, not an unrecorded bank/payment date.
- VAT basis is not verified; displayed prices are untouched and no tax is inferred.
- Master-plan positions are not invented. Building selection is separate; overlays reuse only existing building-plan coordinates.
- Missing-file tasks are omitted because no complete persisted requirements checklist is available.
- Booking stage-transition history is absent; a conversion funnel is explicitly unavailable. Period booking counts are by creation date and current status.
- Tenant counts are explicitly tenant records by unit, not an assumed count of unique customers.
- Shared invoices are shown once at their full recorded amount without guessed allocation between units.
- Manager access uses existing RLS and was checked in source; end-to-end browser verification used the requesting administrator's account only.
- Export is intentionally disabled in follow-up/analytics tabs, empty datasets, failed required reads or incomplete tenant search; building reports require successful collections to avoid presenting missing cash data as zero. Period dates do not filter current unit/tenant snapshots.

## Preview
https://id-preview--d1d73129-051c-4235-a4f0-a74452fc2178.lovable.app/dashboard