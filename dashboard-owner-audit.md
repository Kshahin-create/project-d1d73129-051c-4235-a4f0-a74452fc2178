# First-phase owner dashboard: pre-implementation audit

## Scope and preservation
Read-only inspection on 2026-10-13; user clarification on 2026-10-14. No database records, schema, access grants or published version changed. Frontend owner reporting resumed using the confirmed definitions below.

## Verified workflow
- Booking page invokes the seven-argument `create_booking` function. It writes booking-unit links and immediately sets each requested unit to `reserved`. Pending booking links currently all point to reserved or rented units.
- `confirm_booking` sets linked units to `rented` without requiring positive payment. Admin confirmation passes zero first and records an optional payment separately. One confirmed booking-unit link currently has zero in the booking payment field; this does not prove absence of payment in all other sources.
- The collection trigger updates the tenant account paid balance only, not unit status. `record_payment` writes a paid invoice and account/booking balances, without changing unit status.
- Therefore request-to-reserved matches the confirmed intent, but payment-to-rented is not enforced by the inspected workflows. Keep stored unit status authoritative; do not create a payment threshold or silently reclassify records.

## Financial source inspection (clarification resolved)
- Booking presentation explicitly describes annual advertised rent as excluding 15% VAT. These are current advertised unit prices, not verified signed contract values.
- Financial-claim generation adds 15% VAT to the base payable amount and discloses a VAT-inclusive total to customers.
- Collection entry stores the entered amount unchanged. Collection records have neither tax rate/tax amount/inclusive flag nor invoice identifier. Invoice records also lack structured VAT fields.
- At inspection, 36 nonarchived collections exist. Only one has an invoice candidate matching both unit and amount. Even that match is not an explicit transaction link and cannot establish VAT basis; the remaining 35 have no such candidate.
- Receipt rendering displays the recorded invoice amount as the payment total, without a structured tax breakdown. `record_payment` stores the same supplied amount as invoice amount and paid amount; no tax conversion occurs.
- Source fields alone could not establish tax basis. The owner's explicit historical-record confirmation below now establishes it; no conversion or price-minus-cash calculation is used.

### User confirmations, 2026-10-14
- All existing historical collection amounts and invoice amounts/paid amounts are WITHOUT VAT. Show unchanged and label «بدون الضريبة»; never divide/multiply by 1.15 or change quote tax workflow.
- Rental confirmation is manual after payment: qualifying first instalment or full amount according to chosen payment method. Stored rented status is authoritative, not a balance-derived eligibility test. The earlier workflow discrepancy is resolved by this manual business process; no automation or retrospective reclassification.
- Platform request immediately reserves units; only the first phase currently on the platform is in scope. Owner/investor get identical read options through existing manager/admin access.
- No proof attachments containing personal information were downloaded or disclosed.

## Available event sources
- Genuine unit action history and generic booking audit history exist. Prior review's blanket claim that booking transition history is absent requires correction.
- Rental/cancellation period counts must inspect actual before/after changes and timestamps, exclude insertion-only status snapshots, deduplicate actions and preserve request-versus-unit distinctions. Do not use booking/unit updated timestamps as event dates.
- Only one invoice currently has a real due date; undated receipts cannot be treated as scheduled obligations.

## Live status check
Current phase inventory reconciles: 228 units = 36 rented + 75 reserved + 117 available. These are inspection-time evidence only, not application constants. Existing home uses the same stored statuses. No alternative payment-based count was invented.

## Implementation
- Four count cards, one contrasting status composition, two exact rates, month-default period achievements, grouped VAT-exclusive finance, three actual activity comparisons, aggregate bookings/follow-up and four explicit detail destinations.
- Single projected automatic audit source: unit/booking UPDATE before/after status only, scoped to current unit IDs and linked booking IDs. Duplicate event records deduplicated; rented units counted distinctly within period. Manual unit action log is not unioned with automatic audit.
- Current account identities count authenticated booking account IDs, not unique physical people or tenant rows. Interested-customer count omitted: no verified first-phase association for the existing interested record.
- Follows real invoice due dates only; overdue is a subset of currently due. Shared invoices once. Never computes price minus cash.
- Read-only booking/client dialogs open linked unit detail and real files. Local exports cover every filtered booking, invoice, event, collection, unit and tenant row, with Arabic scope metadata.