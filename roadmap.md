# Sidebar redesign
- [x] Approved presentation-only plan; preserve six sections, all existing routes and visibility rules.
- [x] Reorganize sidebar within six sections, settings subheadings, existing followup/task settings links, home aliases and record active detection, compact icon mode and mobile Escape/route-close controls; preserve existing visibility rules.
- [x] 11 navigation tests pass; authenticated admin desktop 1280×1800, 915×775 and mobile 390×844 verified visually. Compact width 72px, home active, settings auto-open, followup click and drawer closure pass; no overflow/runtime errors; automatic build OK. No business changes or publication.

# Phase 3 / Prompt 11 — Data quality and unified audit
- [x] Inspect audit_log/unit_audit_log/duplicate_candidates/system_backups schemas and cron inventory (12h backup job active; no API for Cloud daily backups).
- [x] Plan approved; migration 0075 applied: 8 live checks, resolutions with audited writer, daily snapshot cron (job 115), unit_audit_log backfilled (112 rows) and frozen read-only/deprecated, admin_audit_log_page.
- [x] UI: /admin/data-quality (findings + تم التصحيح/استثناء), /admin/system-log (filters + audited export), /admin/help (restore steps + last backup 12.8MB), AuditTimeline in record pages, quality count on admin home; 16 tests pass, build OK, admin browser verification of all three pages.
- [ ] Live "تم التصحيح" click not exercised (would hide a real receipt finding); Cloud daily-backup timestamp not displayable in-app (no API — documented in help page).

# Phase 3 / Prompt 10 — Tasks, alerts, activity log
- [x] Inspect existing sources; response 24h maximum, installment 3 days, renewal calendar month then 7 days, daily midnight Asia/Riyadh confirmed.
- [x] Present affected tables/functions/edge files and additive migration plan; approved.
- [x] Add audited tasks, own/team lists and admin assignment, today block, private bell, team views, settings, party/opportunity activity pagination and next-action transaction, source triggers and hourly time windows.
- [x] Verify 6 real tasks remain 6 after regeneration; 8 database rollback assertions; 31 unit tests; admin tasks/team/settings/record/bell desktop/915/mobile no runtime errors/overflow; automatic build OK. Hourly generator and 21:00 UTC summary jobs exist; no messages/site publication or booking-state changes performed.
- [ ] Telegram sanitized sender/queue wake-on-enqueue and summary delivery remain blocked: user declined Telegram connection; new task Telegram delivery stays disabled, existing bot unchanged. Queue schema only, no working delivery processor yet.
- [ ] Finish task creation UI, audited permitted exports/saved personal filters, tenant record notifications and real role/concurrency/source-ledger tests; not yet complete. Actual dedicated sales/accountant/leasing sessions unavailable; Prompt 9 protection remains incomplete.

# Phase 2 / Prompt 9 — Roles, permissions, security
- [x] Review existing roles, policies, writers, account flows and private documents; resolve dynamic roles and admin approvals.
- [x] Present complete affected tables/functions/edge files and additive migration plan; approved.
- [x] Add dynamic role registry/matrix, audited role assignment, contact masking, direct CRM write revocation, internal-table locks, staff invitation/deactivation foundation and matrix guide.
- [ ] Complete all RLS/writer/edge capability enforcement, mandatory TOTP, approval execution, tenant portal/OTP linkage, session lists, draft UI and private-file scopes; not yet implemented end-to-end.
- [ ] Remediate deep scan remaining alerts: Telegram jobs/document send authorization, mobile redirects, access-log spoofing and external API leakage. Backup hardcoded-secret bypass removed, destructive restore/delete disabled; deployed verification pending.
- [x] Verify admin matrix/directory with 287 users, 9 live DB safety checks, 26 unit tests and automatic build; desktop/915/mobile show no overflow. No real invitations, deactivations or booking changes executed.
- [ ] Verify deployed edge/OTP/MFA/storage paths and actual sales/tenant role sessions; no dedicated sales account exists yet. Remaining implementation above is unfinished, not blocked by credentials.

# Phase 2 / Prompt 8 — Dashboard and metrics
- [x] Inspect current reporting sources and clarify grace days=3, period installment allocation ratio and independent investor access.
- [x] Present affected tables/functions/edge functions/files and additive migration plan; approved.
- [x] Add central snapshots/drilldowns, role home, executive presentation, investor scope, VAT display and deployed API/MCP/Telegram report adapters; preserve review gate.
- [ ] Finish verification: admin counts/drilldown/export and deployed developer parity passed; 33 tests and 8 live DB checks passed. Dedicated role sessions and external API/MCP key checks await selected accounts/test key; synthetic real ledger attribution/reversal coverage remains unverified. Historical evidence-only report modules remain separate. Desktop/915/mobile and 708-row XLSX scope sheet verified; no final cutover/site publish or live test Telegram sends.

# Phase 2 / Prompt 7 — Navigation, record pages, global search
- [x] Present affected tables/views/functions/edge functions/files and migration scope; plan approved.
- [x] Organize six navigation sections, Settings/Developers and compatible redirects; preserve all dashboards until Prompt 8 is verified.
- [x] Add linked unit/party/contract/receipt/booking record pages using existing permission-gated Phase 1 data.
- [x] Add permission-aware server search and shared server list controls; paged directory, tenant accounts, paid tenants, pipeline and party units; audited CSV/XLSX exports and own preferences.
- [x] Verify admin real record navigation/search, party tabs, 708-row CSV, export audit, legacy developer redirect and desktop/mobile/current viewport; 32 tests and automatic build passed.
- [ ] Verify dedicated manager/accountant/leasing-manager/sales sessions and real contract/private-file chains — blocked: no selected dedicated role session, no accountant/leasing-manager/sales users and no new contract records.
- [ ] Finish literal every-list/every-link coverage and saved external-filter restoration on remaining specialized lists — not fully completed in this pass; existing workflows retained.

# Phase 1 / Prompt 6 — Contracts, installments, receipts
- [x] Approve the plan, separate accountant role and historical precision reconciliation.
- [x] Add audited contracts, plans, installments, receipts, allocations and private documents; integrate manual leasing-manager confirmation and first-installment gate.
- [x] Preserve 37 collection and 17 invoice payment sources with precision provenance; verify zero unexplained differences and live source integrity; make legacy sources immutable including service-role paths.
- [x] Add financial lists and canonical unit report; route booking payments to receipts, retire legacy UI mutations and Telegram payment/proof mutations; verify 35 unit tests and 11 database rollback assertions, desktop/mobile and automatic build.
- [ ] Approve duplicate provenance and historical cash/date/VAT links — blocked: 54 source records require human review; final cash-ledger adoption stays disabled.
- [ ] Verify accountant/manager/sales-agent dedicated sessions, real concurrency and private-file expiry; complete ergonomic contract/receipt editors, notification and all legacy report integrations before claiming Prompt 6 finished.

# Phase 1 / Prompt 5 — CRM inside the platform
- [x] Parties/opportunities/ownership tables, sales_agent role, backfill (954 parties, 49 won opportunities, 157 linked bookings), round-robin assignment, hourly reopen cron.
- [x] Writer functions with Arabic errors, contact masking for agents, booking/leasing stage hooks, no-answer auto-close at 10, transfer requests and bulk reassign.
- [x] Screens: pipeline board/list, party, opportunity, unassigned queue, team performance, target-list import; 7 unit tests pass; admin preview verified.
- [ ] Verify with a real sales_agent account (masking, hold creation, transfer request) — blocked: no sales agent user exists yet.

# Phase 1 / Prompt 4 — One unit-status writer
- [x] Present affected surfaces, additive migration/backfill and verification plan; approved.
- [x] Implement the status writer/write guard, 48-hour holds/one extension, separate leasing manager and linked contract/payment verification.
- [x] Connect booking writers, Telegram dispatcher and compatible status reads; add unit timeline, contracts and historical review.
- [x] Verify database rollback regression flow, control/manager restrictions, duplicate booking/extension, 47 unit tests, authenticated desktop unit dialogs and mobile sign-in gate.
- [ ] Verify authenticated external API/MCP end-to-end (blocked: no integration test key supplied); real simultaneous concurrency and actual cron timing remain unverified.

# Respond.io marketing campaigns
- [x] Collect all customer phone sources and deduplicate securely.
- [x] Add admin campaign page, durable send tracking and explicit confirmation.
- [x] Test normalization, audience rules and live authenticated preview without sending real messages; deploy the campaign function.

# User directory details
- [x] Show registered names, uploaded avatars and contact/profile details in the admin user directory.
- [x] Show latest recorded access IP and country with read-only account details.
- [x] Verify authenticated directory and details on desktop/mobile without changing user records.

# Manager read-only access
- [x] Audit and block manager administrative writes in database functions/policies and service functions.
- [x] Remove manager editing controls, including returning-customer marking and user deletion.
- [x] Test permission rules and verify admin view plus simulated manager UI; real manager-session end-to-end remains unverified (no manager session supplied).

# Tyre shops and car washes
- [x] Verify red unit numbers visually in owner plans for buildings 7–10 and cross-check the activity sheet.
- [x] Limit tyre/car-wash selection to those units, show other units reserved for these activities, and preserve actual bookings and other activities without changing occupancy records.
- [x] Test exact mapping/counts and verify authenticated selection through details, spare-parts independence and desktop/mobile rendering; no real booking submitted.

# Email corrections
- [x] Correct Arabic rendering and RTL in email templates.
- [x] Correct company roles in booking emails.
- [x] Use total workshop area for each unit and the booking total.
- [x] Verify rendering and deploy affected email functions.

# Dashboard redesign
- [x] Replace dashboard presentation with an Arabic management workspace and shared filters.
- [x] Add read-only, permission-gated data reads and verified map/detail views.
- [x] Verify financial/status aggregates, responsive layouts, and existing-data flows; do not publish.

# Dashboard review follow-up
- [x] Replace technical labels with Arabic business labels and add complete filtered local Excel exports.
- [x] Clamp pagination after refresh and warn when tenant search is degraded.
- [x] Explain generated type-file changes in the review; run tests and inspect desktop/mobile and automatic build, without publishing or record changes.

# Executive summary redesign
- [x] Replace the default dashboard with four unit KPIs, status/rate summary, separate financial figures and compact building aggregates.
- [x] Move all filters, tables, plans and operations into explicit detail views with independent scope and a return control.
- [x] Verify formulas, home/detail independence, exports, automatic build and desktop/mobile presentation without record changes or publication.

# Final owner/investor first-phase dashboard
- [x] Audit actual reservation/payment workflows, tax basis and available dated history using read-only evidence.
- [x] Resolve collection/invoice VAT basis: user confirmed all existing historical amounts exclude VAT and manual rental confirmation follows qualifying payment.
- [x] Implement approved owner presentation, dated progress, activity comparison and four optional detail destinations; preserve authoritative stored statuses.
- [x] Verify aggregate parity, meaningful tests, automatic build and desktop/mobile walkthrough after implementation.

# Owner reporting polish
- [x] Refine executive hierarchy, contextual activity/status drilldowns and independent building scope.
- [x] Add organized report destinations and read-only data review with full scoped exports.
- [x] Verify live drilldown parity, downloads, responsive layout, tests and automatic build without publication.

# Booking activity polish
- [x] Add independent carpentry and smithing activity choices and preserve them throughout building selection and sign-in.
- [x] Correct stale project counts and review expanded plan rendering without changing records.
- [x] Run relevant tests and verify actual booking selection on desktop/mobile without submitting a booking or publishing.

# SMS sender name change
- [x] Send all verification SMS under the new sender name and retire the previous one.
- [x] Deploy both SMS-sending functions and confirm no code still references the old name.

# Ejar SEO and AI discovery
- [x] Optimize homepage images and stabilize their dimensions; reduce initial application code.
- [x] Add accurate public-page metadata, structured data, sitemap, robots reference and llms.txt without exposing private routes.
- [x] Verify public pages, image loading, crawler files and regression tests; do not change booking records.
- [ ] Complete Google Search Console verification and sitemap submission (blocked: connection request declined).
- [ ] Verify real HTTP 404 and server-rendered content (blocked: requires hosting/template change, not a client-side fix).
