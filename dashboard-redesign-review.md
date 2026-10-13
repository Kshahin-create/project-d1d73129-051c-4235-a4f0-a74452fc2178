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

## Checks
- Vitest: all 11 tests passed across 3 files, including six dashboard aggregate/filter/period/obligation tests.
- Authenticated Chromium preview: desktop 1280×1800 and mobile 390×844 inspected; no runtime errors or mobile horizontal overflow.
- Verified actual all-period collections, building selection, KPI drilldown, maintenance empty state, actual dated invoice follow-up and read-only unit details.
- Build/typecheck are managed automatically by Lovable; no manual build or typecheck was run.
- Dashboard-specific modules contain no inserts, updates, deletes, schema operations or side-effect RPCs; no publishing performed.

## Reporting limitations
- Collection period uses the real `created_at` registration timestamp, not an unrecorded bank/payment date.
- VAT basis is not verified; displayed prices are untouched and no tax is inferred.
- Master-plan positions are not invented. Building selection is separate; overlays reuse only existing building-plan coordinates.
- Missing-file tasks are omitted because no complete persisted requirements checklist is available.
- Booking stage-transition history is absent; a conversion funnel is explicitly unavailable. Period booking counts are by creation date and current status.
- Tenant counts are explicitly tenant records by unit, not an assumed count of unique customers.
- Shared invoices are shown once at their full recorded amount without guessed allocation between units.
- Manager access uses existing RLS and was checked in source; end-to-end browser verification used the requesting administrator's account only.

## Preview
https://id-preview--d1d73129-051c-4235-a4f0-a74452fc2178.lovable.app/dashboard