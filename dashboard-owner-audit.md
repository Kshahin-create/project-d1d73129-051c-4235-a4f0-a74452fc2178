# First-phase owner dashboard: pre-implementation audit

## Scope and preservation
Read-only inspection on 2026-10-13. No application code, database records, schema, access grants or published version changed. Final redesign is pending financial clarification, not completed or visually verified.

## Verified workflow
- Booking page invokes the seven-argument `create_booking` function. It writes booking-unit links and immediately sets each requested unit to `reserved`. Pending booking links currently all point to reserved or rented units.
- `confirm_booking` sets linked units to `rented` without requiring positive payment. Admin confirmation passes zero first and records an optional payment separately. One confirmed booking-unit link currently has zero in the booking payment field; this does not prove absence of payment in all other sources.
- The collection trigger updates the tenant account paid balance only, not unit status. `record_payment` writes a paid invoice and account/booking balances, without changing unit status.
- Therefore request-to-reserved matches the confirmed intent, but payment-to-rented is not enforced by the inspected workflows. Keep stored unit status authoritative; do not create a payment threshold or silently reclassify records.

## Financial ambiguity: blocked indicators
- Booking presentation explicitly describes annual advertised rent as excluding 15% VAT. These are current advertised unit prices, not verified signed contract values.
- Financial-claim generation adds 15% VAT to the base payable amount and discloses a VAT-inclusive total to customers.
- Collection entry stores the entered amount unchanged. Collection records have neither tax rate/tax amount/inclusive flag nor invoice identifier. Invoice records also lack structured VAT fields.
- At inspection, 36 nonarchived collections exist. Only one has an invoice candidate matching both unit and amount. Even that match is not an explicit transaction link and cannot establish VAT basis; the remaining 35 have no such candidate.
- Receipt rendering displays the recorded invoice amount as the payment total, without a structured tax breakdown. `record_payment` stores the same supplied amount as invoice amount and paid amount; no tax conversion occurs.
- Total/period tax-exclusive collections, cash progress, and tax-exclusive invoice due/overdue amounts cannot be claimed from this evidence. Do not divide all amounts by 1.15 or use advertised rent minus cash as outstanding.

### Specific clarification required
Are existing collection amounts and invoice amount/paid amounts entered excluding VAT, including VAT, or mixed? If mixed, which existing transaction evidence identifies the basis for each record? Confirmation must cover historical records, not merely a future entry convention. No proof attachments containing personal information were downloaded or disclosed.

## Available event sources
- Genuine unit action history and generic booking audit history exist. Prior review's blanket claim that booking transition history is absent requires correction.
- Rental/cancellation period counts must inspect actual before/after changes and timestamps, exclude insertion-only status snapshots, deduplicate actions and preserve request-versus-unit distinctions. Do not use booking/unit updated timestamps as event dates.
- Only one invoice currently has a real due date; undated receipts cannot be treated as scheduled obligations.

## Live status check
Current phase inventory reconciles: 228 units = 36 rented + 75 reserved + 117 available. These are inspection-time evidence only, not application constants. Existing home uses the same stored statuses. No alternative payment-based count was invented.

## Pending delivery
Presentation changes, new aggregate tests, browser walkthrough and final automatic build verification remain pending implementation; earlier checks apply only to the previous summary.