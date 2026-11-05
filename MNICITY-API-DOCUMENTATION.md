# MNICITY Booking Platform — CRM Integration API (v1.2, Read-Only)

> Audience: engineers (and Claude Code) building an external, independent CRM (e.g. Django) that pulls data from the MNICITY industrial-city booking platform.
> All examples use **fictional data**. No real customer data or secrets appear in this file.

---

## 1. Current system architecture

| Layer | Technology |
|---|---|
| Web app | React + Vite SPA (booking site, admin, owner dashboard) — `https://ejar.mnicity.com` |
| Backend | Lovable Cloud (managed Postgres + Auth + Storage + Edge Functions on Deno) |
| Integration API | Edge Function `crm-api` (this document) — **GET only** |
| Legacy API | Edge Function `api` — v2.0, **read-only (GET only)**, no personal data, CORS restricted to an allow-list. **Not for CRM use** (see §13). |

Business flow that produces the data:

```text
Customer picks activity -> building -> units -> submits booking request
   create_booking(): booking.status = pending, units.leasing_status = on_hold, expires_at from app_settings
Admin confirms request -> booking.status = confirmed, units.leasing_status = pending_contract
Active contract + explicitly verified first receipt + manual confirmation -> units.leasing_status = leased
No action before expires_at            -> booking.status = expired, units back to available
Admin/customer cancels                 -> booking.status = cancelled, units back to available
Payments are recorded through audited receipts and installment allocations. Legacy unit_collections and invoices are immutable evidence only; historical reconciliation remains pending.
```

Unit state now uses `leasing_status`: `available | on_hold | pending_contract | leased | maintenance | blocked`.
`null` means unresolved legacy data awaiting review and is never bookable. Historical `units.status` is frozen.
Read-only legacy responses project `status`: available→available, leased→rented, maintenance→maintenance,
all other states→reserved (unavailable). CRM unit responses also include `leasing_status`; no API writes were added.
Holds use database settings: 48 hours and one extension, by the separate leasing-manager role with a reason.

Scope: **all registered project units**, excluding test units. Building phase comes from buildings.phase; currently unassigned phases must not be inferred.

## 2. Tables and relationships (actually existing)

Exposed through the API:

| Table | API resource | Key relations |
|---|---|---|
| `buildings` | `/buildings` | `units.building_number -> buildings.number` |
| `units` | `/units` | belongs to building (by number) |
| `bookings` | `/bookings` | has many `booking_units` (embedded) ; `previous_tenant_account_id -> tenant_accounts.id` |
| `booking_units` | embedded in bookings | `booking_id -> bookings.id`, `unit_id` (snapshot of unit at booking time) |
| `tenant_accounts` | `/customers` | many-to-many units via `tenant_account_units` (embedded as `unit_ids`) ; `merged_into -> tenant_accounts.id` |
| `tenants` | `/tenancies` | `unit_id -> units.id`, `booking_id` ; has `start_date`/`end_date` (closest thing to a lease) |
| `invoices` | `/invoices` | `tenant_account_id`, `unit_id`, `booking_id` |
| `unit_collections` | `/collections` | `unit_id`, `tenant_account_id` (actual money received) |
| `interested_customers` | `/leads` | standalone (sales leads, incl. Telegram) |

Existing but **not exposed** (internal/security): `profiles`, `user_roles`, `customer_profiles`, `api_keys`, `audit_log`, `unit_audit_log`, `access_log`, OTP tables, email tables, telegram tables, backups, `app_settings`, `leads` (legacy sheet import), `tenant_account_files`, `unit_files`.

**Do not exist:** contracts table, payment schedules / instalment plans table, payment review/approval workflow table. `bookings.payment_plan` (`full`, `50`, `70`) is the only payment-plan information.

## 3. Base URL and authentication

```
Base URL: https://wqzseofoerwevfebguse.supabase.co/functions/v1/crm-api
```

- Header: `X-API-Key: <key>` on every request. Keys look like `nkb_live_…`.
- Keys are created by an admin at `https://ejar.mnicity.com/admin/api-keys`; the raw key is shown **once**; only a SHA-256 hash is stored. Keys can be revoked and can have an expiry.
- Store the key in your CRM's secret store / env var (e.g. `MNICITY_API_KEY`). Never commit it.
- Server-to-server only. Do not call from a browser.

### Scopes

| Scope | Grants |
|---|---|
| `crm:read` | **Required.** buildings, units, bookings, customers, tenancies — personal & financial fields returned as `null`. |
| `crm:pii` | Names, phones, emails, business names, CR numbers, notes. Required for `/leads`. |
| `crm:finance` | `paid_amount`, `total_price` on accounts, `expected_annual_revenue`. Required for `/invoices` and `/collections`. |

Legacy `read`/`write`/`admin` keys are rejected (403) by `crm-api`. Unit list prices (`units.price`, `booking_units.price`, `bookings.total_price`) are public catalogue prices and are returned with `crm:read`.

All monetary amounts are **SAR excluding VAT** as recorded (confirmed by the business for current records).

## 4. Endpoints

All endpoints: `GET` only. Any other method → `405`.

| Method | Path | Extra scope | Filters |
|---|---|---|---|
| GET | `/meta` | – | – |
| GET | `/buildings` , `/buildings/{id}` | – | `type`, `number` |
| GET | `/units` , `/units/{id}` | – | `status`, `building_number`, `activity`, `unit_type` |
| GET | `/bookings` , `/bookings/{id}` | – | `status`, `payment_plan` |
| GET | `/customers` , `/customers/{id}` | – | `activity_type`, `merged_into` (uuid or `null`) |
| GET | `/tenancies` , `/tenancies/{id}` | – | `unit_id`, `booking_id` |
| GET | `/invoices` , `/invoices/{id}` | `crm:finance` | `paid` (true/false), `tenant_account_id`, `booking_id` |
| GET | `/collections` , `/collections/{id}` | `crm:finance` | `unit_id`, `tenant_account_id`, `is_archived` |
| GET | `/leads` , `/leads/{id}` | `crm:pii` | `status`, `source` |
| GET | `/booking_units` , `/booking_units/{id}` | – | `booking_id`, `unit_id`, `building_number` |
| GET | `/unit_status_history` , `/{id}` | – (email/reason need `crm:pii`) | `unit_id`, `building_number`, `new_status`, `action` |
| GET | `/contacts` , `/contacts/{id}` | `crm:pii` | `activity_type`, `user_id` |
| GET | `/whatsapp_leads` , `/whatsapp_leads/{id}` | `crm:pii` | `status` |
| GET | `/campaigns` , `/campaigns/{id}` | – | `status`, `template_name`, `language` |
| GET | `/campaign_recipients` , `/{id}` | `crm:pii` | `campaign_id`, `status` |
| GET | `/templates` | – | – (not paginated) |
| GET | `/email_logs` , `/email_logs/{id}` | `crm:pii` | `template_name`, `status` |
| GET | `/tenant_files` , `/tenant_files/{id}` | – (names need `crm:pii`) | `tenant_account_id`, `is_archived` |
| GET | `/unit_files` , `/unit_files/{id}` | – | `unit_id` |
| GET | `/access_log` , `/access_log/{id}` | `crm:pii` | `event`, `user_id` |

`{id}` is a UUID.

### Common list parameters

| Param | Description |
|---|---|
| `limit` | 1–500, default 100 |
| `cursor` | opaque value from previous `pagination.next_cursor` |
| `updated_since` | ISO-8601; returns rows with `updated_at >= value` |

Lists are ordered by `(updated_at ASC, id ASC)` — stable for incremental sync.

### List response envelope

```json
{
  "data": [ ... ],
  "pagination": { "limit": 100, "has_more": true, "next_cursor": "eyJ0IjoiMjAyNi0..." },
  "sync": { "timestamp_field": "updated_at", "server_time": "2026-10-28T14:00:00.000Z" }
}
```

Single record: `{ "data": { ... } }`.

## 4b. Messaging, contacts & activity resources (added in v1.1)

| Resource | Source table | Sync field | Meaning |
|---|---|---|---|
| `contacts` | `customer_profiles` | `updated_at` | Registered platform users (phone, email, business). |
| `whatsapp_leads` | `leads` | `updated_at` | WhatsApp conversations with last message text/time. |
| `campaigns` | `marketing_campaigns` | `updated_at` | WhatsApp marketing campaigns: name, Respond.io `template_name`, `language`, `channel_id`, template `components` (variables), `status` (`paused`/`running`/`completed`), `audience_summary` (counts per source). |
| `campaign_recipients` | `marketing_recipients` | `updated_at` | One row per phone per campaign: `phone` (E.164), `sources` (Arabic source labels, e.g. `المستخدمون`), `status`, `provider_response`, `error`, `attempted_at`. |
| `templates` | derived from `marketing_campaigns` | – | Distinct template_name + language used by the platform, with `campaigns_count`, `first_used_at`, `last_used_at`, last `components`. Template bodies/approval live in Respond.io, not in this platform. |
| `email_logs` | `email_send_log` | `created_at` | Every app email: template, recipient, status (`pending`/`sent`/`failed`/`suppressed`/`bounced`...), error. Multiple rows per `message_id` — keep the latest. |
| `booking_units` | `booking_units` | `created_at` | Units attached to each booking (also embedded in `/bookings`). |
| `unit_status_history` | `unit_audit_log` | `created_at` | Every unit status change (previous → new). Append-only. |
| `tenant_files`, `unit_files` | file metadata | – | Document metadata only; file contents/storage paths are not exposed. |
| `access_log` | `access_log` | `created_at` | Sign-in/sign-up events with IP, country/city, ISP, device. |

### Recipient status values
| status | Meaning |
|---|---|
| `queued` | Not attempted yet |
| `sending` | Claimed by a sender, in progress |
| `accepted` | Respond.io accepted the message (NOT proof of delivery/read) |
| `failed` | Provider rejected; see `error` |
| `unknown` | Result uncertain (timeout); never auto-retried |

### Example — `GET /campaigns?status=completed&limit=1` (fictional)
```json
{
  "data": [{
    "id": "7c1e0c3a-0000-4000-8000-000000000001",
    "name": "عرض نوفمبر",
    "template_name": "november_offer",
    "language": "ar",
    "channel_id": 123456,
    "components": [],
    "status": "completed",
    "audience_summary": { "total": 500, "by_source": { "المستخدمون": 300 } },
    "created_at": "2026-11-01T10:00:00Z",
    "updated_at": "2026-11-01T10:20:00Z"
  }],
  "pagination": { "limit": 1, "has_more": false, "next_cursor": null },
  "sync": { "timestamp_field": "updated_at", "server_time": "2026-11-01T12:00:00Z" }
}
```

### Example — `GET /campaign_recipients?campaign_id=...&status=failed` (fictional)
```json
{ "data": [{ "id": "9b...", "campaign_id": "7c1e...", "phone": "+966500000000", "sources": ["المستخدمون"], "status": "failed", "provider_response": { "code": 400 }, "error": "Contact not on WhatsApp", "attempted_at": "2026-11-01T10:05:00Z", "updated_at": "2026-11-01T10:05:00Z" }] }
```

### Building a unified phone book in the CRM
Union phones from `contacts.phone`, `customers.phone`, `tenancies.phone`, `bookings.customer_phone`, `leads.phone`, `whatsapp_leads.phone`, normalize to E.164 (`+9665XXXXXXXX`) and dedupe on that key. `campaign_recipients` already contains deduplicated E.164 phones per campaign.

### Never exposed
OTP codes, login/one-time tokens, API keys, Telegram bot memory, backups, file storage paths, Respond.io/API secrets. Sending messages is NOT possible through this API (read-only).

## 5. Examples (fictional data)

```bash
curl -H "X-API-Key: $MNICITY_API_KEY" \
  "$BASE/units?status=available&building_number=3&limit=2"
```

`GET /meta`
```json
{ "data": {
  "api_version": "1.0",
  "project": { "code": "MNICITY", "name_ar": "المدينة الصناعية بشمال مكة المكرمة" },
  "phase": { "code": "phase-1", "name_ar": "المرحلة الأولى", "note": "Single phase; no phases table exists." },
  "scopes": ["crm:read"],
  "resources": ["buildings","units","bookings","customers","tenancies","invoices","collections","leads"],
  "server_time": "2026-10-28T14:00:00.000Z" } }
```

`GET /buildings`
```json
{ "data": [ { "id": "0b6c…-0001", "number": 3, "type": "مراكز صيانة سيارات",
  "expected_annual_revenue": null, "created_at": "2026-05-01T09:00:00Z", "updated_at": "2026-09-01T09:00:00Z" } ], "pagination": {"limit":100,"has_more":false,"next_cursor":null}, "sync": {"timestamp_field":"updated_at","server_time":"2026-10-28T14:00:00Z"} }
```

`GET /units/{id}`
```json
{ "data": { "id": "6f1e…-a001", "building_number": 3, "unit_number": 330, "unit_type": "ورشة",
  "activity": "صيانة سيارات", "area": 132, "price": 30000, "status": "available",
  "created_at": "2026-10-20T10:00:00Z", "updated_at": "2026-10-20T10:00:00Z" } }
```

`GET /bookings/{id}` — key with `crm:read` only:
```json
{ "data": {
  "id": "b7d2…-0001", "offer_number": "OF-2026-0099", "status": "pending", "payment_plan": "50",
  "units_count": 2, "total_area": 264, "total_price": 60000, "paid_amount": null,
  "customer_full_name": null, "customer_phone": null, "customer_email": null,
  "business_name": null, "cr_number": null, "notes": null, "offer_image_url": null,
  "is_returning_customer": false, "previous_tenant_account_id": null,
  "expires_at": "2026-10-30T10:00:00Z", "confirmation_sent_at": null,
  "created_at": "2026-10-28T10:00:00Z", "updated_at": "2026-10-28T10:00:00Z",
  "booking_units": [
    { "unit_id": "6f1e…-a001", "building_number": 3, "unit_number": 330, "unit_type": "ورشة", "area": 132, "price": 30000, "activity": "صيانة سيارات" },
    { "unit_id": "6f1e…-a002", "building_number": 3, "unit_number": 331, "unit_type": "ورشة", "area": 132, "price": 30000, "activity": "صيانة سيارات" } ] } }
```
With `crm:pii` + `crm:finance` the nulls are filled, e.g. `"customer_full_name": "مؤسسة مثال للتجارة"`, `"customer_phone": "+966500000000"`, `"paid_amount": 30000`.

`GET /customers/{id}` (all scopes)
```json
{ "data": { "id": "c1a0…-0001", "full_name": "شركة نموذج المحدودة", "phone": "+966511111111",
  "email": "info@example.com", "business_name": "نموذج", "cr_number": "7000000000",
  "activity_type": "صيانة سيارات", "notes": null, "total_price": 60000, "paid_amount": 30000,
  "merged_into": null, "merged_at": null, "is_merged": false,
  "unit_ids": ["6f1e…-a001","6f1e…-a002"],
  "created_at": "2026-06-01T08:00:00Z", "updated_at": "2026-10-01T08:00:00Z" } }
```

`GET /tenancies` item
```json
{ "id": "t9…-01", "unit_id": "6f1e…-a001", "booking_id": "b7d2…-0001", "tenant_name": "شركة نموذج المحدودة",
  "business_name": "نموذج", "activity_type": "صيانة سيارات", "phone": "+966511111111", "cr_number": "7000000000",
  "start_date": "2026-07-01", "end_date": "2027-06-30", "notes": null, "offer_image_url": null,
  "created_at": "…", "updated_at": "…" }
```

`GET /invoices` item
```json
{ "id": "i1…-01", "invoice_number": "INV-2026-0012", "tenant_account_id": "c1a0…-0001", "booking_id": "b7d2…-0001",
  "unit_id": null, "amount": 30000, "paid_amount": 30000, "paid": true, "paid_at": "2026-07-02T12:00:00Z",
  "due_date": null, "period_start": null, "period_end": null, "payment_method": "bank_transfer",
  "customer_name": "شركة نموذج المحدودة", "customer_phone": "+966511111111", "customer_business": "نموذج",
  "cr_number": "7000000000", "notes": null, "created_at": "…", "updated_at": "…" }
```

`GET /collections` item
```json
{ "id": "k1…-01", "unit_id": "6f1e…-a001", "tenant_account_id": "c1a0…-0001", "amount": 15000,
  "is_archived": false, "proof_name": "receipt.pdf", "proof_mime": "application/pdf",
  "created_at": "2026-07-02T12:00:00Z", "updated_at": "2026-07-02T12:00:00Z" }
```

`GET /leads` item
```json
{ "id": "l1…-01", "full_name": "عميل محتمل", "phone": "+966522222222", "business_name": null,
  "requested_activity": "حدادة", "requested_building": "17", "requested_unit": null,
  "customer_source": "تيليجرام", "source": "telegram", "status": "new", "notes": null,
  "created_at": "…", "updated_at": "…" }
```

## 6. Status reference

**Unit (`units.status`)**: `available` (bookable) · `reserved` (held by a pending booking, or rented but not fully confirmed by admin) · `rented` (manually confirmed after payment). Unknown future values must be stored as-is, not rejected.

**Booking (`bookings.status`)**: `pending` (request submitted, units reserved, until `expires_at`) · `confirmed` (admin confirmed after first instalment or full payment depending on `payment_plan`) · `expired` (not confirmed before `expires_at`; units released) · `cancelled`.

**Payment plan (`bookings.payment_plan`)**: `full`, `50`, `70` (percent of first instalment). No instalment schedule table exists.

**Payments**: there is no review/approval status. `unit_collections` = money recorded as received (`is_archived=true` means voided/hidden by admin — exclude from totals). `invoices.paid` / `paid_amount` / `paid_at` describe invoice settlement. Becoming `rented` is a **manual** admin action — do not infer it from balances.

**Lead (`interested_customers.status`)**: currently `new`; treat as free text.

## 7. Errors

```json
{ "error": { "code": "forbidden", "message": "Resource requires 'crm:finance' scope" } }
```

| HTTP | code | When |
|---|---|---|
| 400 | `bad_request` | invalid cursor, `updated_since`, or filter value |
| 401 | `unauthorized` | missing / invalid / revoked / expired key |
| 403 | `forbidden` | key lacks `crm:read` or the resource's extra scope |
| 404 | `not_found` | unknown route or record id |
| 405 | `method_not_allowed` | anything other than GET |
| 500 | `internal_error` | unexpected server error (retry with backoff) |

## 8. Django integration guide

`settings.py`
```python
MNICITY_API_BASE = os.environ["MNICITY_API_BASE"]   # base URL above
MNICITY_API_KEY  = os.environ["MNICITY_API_KEY"]
```

`mnicity/client.py`
```python
import time, requests
from django.conf import settings

class MnicityClient:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"X-API-Key": settings.MNICITY_API_KEY})

    def get(self, path, **params):
        for attempt in range(5):
            r = self.s.get(f"{settings.MNICITY_API_BASE}{path}", params=params, timeout=30)
            if r.status_code >= 500:
                time.sleep(2 ** attempt); continue
            r.raise_for_status()
            return r.json()
        r.raise_for_status()

    def iterate(self, resource, updated_since=None, **filters):
        params = {"limit": 500, **filters}
        if updated_since: params["updated_since"] = updated_since
        while True:
            page = self.get(f"/{resource}", **params)
            yield from page["data"]
            if not page["pagination"]["has_more"]: break
            params["cursor"] = page["pagination"]["next_cursor"]
```

Model pattern (source id is the unique key):
```python
class MnicityUnit(models.Model):
    source_id = models.UUIDField(unique=True)
    building_number = models.IntegerField()
    unit_number = models.IntegerField()
    status = models.CharField(max_length=32)
    area = models.DecimalField(max_digits=12, decimal_places=2)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    source_updated_at = models.DateTimeField()
    last_seen_at = models.DateTimeField(auto_now=True)
    raw = models.JSONField()

class SyncCursor(models.Model):
    resource = models.CharField(max_length=32, unique=True)
    high_water = models.DateTimeField(null=True)
```

Sync command (`manage.py sync_mnicity`):
```python
def sync(resource, Model, mapper):
    cur, _ = SyncCursor.objects.get_or_create(resource=resource)
    since = (cur.high_water - timedelta(minutes=5)).isoformat() if cur.high_water else None
    hw = cur.high_water
    for row in MnicityClient().iterate(resource, updated_since=since):
        Model.objects.update_or_create(source_id=row["id"], defaults={**mapper(row), "raw": row,
                                       "source_updated_at": row["updated_at"]})
        hw = max(hw or parse(row["updated_at"]), parse(row["updated_at"]))
    cur.high_water = hw; cur.save()
```
Run every 5–15 minutes via Celery beat / cron. Sync order: buildings → units → customers → bookings → tenancies → invoices → collections → leads.

## 9. Sync strategy & de-duplication

1. **Identity:** always upsert by `id` (UUID). Never key on phone/name.
2. **Incremental:** store the max `updated_at` seen per resource; next run pass `updated_since = high_water − 5 min` (overlap absorbs clock skew/concurrent writes; upsert makes repeats harmless).
3. **Pagination:** follow `next_cursor` until `has_more=false`; don't mix offset logic.
4. **Initial load:** run with no `updated_since`.
5. **Customers:** duplicates may be merged by admins. A merged account has `merged_into = <canonical id>`; in the CRM, point references to the canonical account and mark the duplicate inactive.
6. **booking_units** are snapshots — they are replaced with their parent booking; don't sync separately.
7. A unit's history: units can return from reserved/rented to available — always overwrite status from the latest record.

## 10. Updates, deletion and cancellation

- Updates → new `updated_at` → picked up by incremental sync.
- Cancellation/expiry are **status changes**, not deletes (`cancelled`, `expired`). Units released back show `available`.
- Voided collections: `is_archived = true`.
- Hard deletes exist in a few admin flows (e.g. tenant rows, units) and there is **no deletion feed/tombstones**. Run a nightly **full reconciliation**: iterate all ids of each resource (no `updated_since`), and soft-delete in the CRM any `source_id` not seen (`last_seen_at` older than the run start).

## 11. Security & permissions

- Read-only: no endpoint can create, modify or delete data; non-GET → 405.
- Keys: hashed at rest, revocable, optional expiry, `last_used_at` tracked, managed by admins only.
- Field-level redaction by scope (personal → `crm:pii`, money → `crm:finance`).
- Not exposed: auth users, roles, OTPs, audit/access logs, files and storage paths, backups.
- Recommended: one key per environment, minimum scopes, rotate periodically, keep logs of the CRM's requests, no browser usage.
- CORS is open, but a key is required for every call; never ship the key to a frontend.

## 12. Limits

- Max 500 rows per page. No server rate limit is enforced yet — keep ≤ 5 req/s.
- Filters are exact-match only (no search/ranges except `updated_since`).

## 13. What was implemented and tested — and what was not

**Implemented (2026-10-28):**
- Edge Function `crm-api` (GET-only, 8 resources + `/meta`, cursor pagination, `updated_since`, exact filters, scope-based redaction). Deployed.
- New scopes `crm:read`, `crm:pii`, `crm:finance` selectable in `/admin/api-keys`.
- No database schema change, no data modification, booking logic untouched.

**Tested:**
- Unit tests (6): redaction for pii/finance, scope keeps fields, page cap 500, cursor round-trip/garbage rejection, legacy keys refused.
- Live calls against deployed function: no key → 401; fake key → 401; POST → 405; DELETE → 405.

**Not yet tested:**
- Successful authenticated calls with a real `crm:*` key (no key was created to avoid writing to production during build). Admin should create a key and run `GET /meta` then `GET /units?limit=5` to confirm.

**Not implemented / not available:**
- Projects/phases tables, contracts, payment schedules, payment review/approval — they don't exist in the platform.
- Webhooks/push events (pull-only for now), deletion tombstones, rate limiting.
- Write API for the CRM (phase 2).
- **Legacy `api` (v2.0):** read-only. Remaining routes: `GET /buildings`, `/buildings/:number`, `/units`, `/units/:id`, `/bookings`, `/bookings/:id`, `/stats`, `/stats/overview`. Any non-GET method returns 405. `/tenants`, `/tenant-accounts`, `/customers`, `/users`, `/audit-log`, `/invoices` return 410. Responses contain unit fields and aggregate counts only; bookings return real database IDs without customer data. Browser CORS is limited to `app_settings.api_cors_allowlist`.


## 16. Central dashboard metrics (v1.2)

`GET /metrics` requires both `crm:read` and **`crm:metrics`**. Finance is omitted unless **`crm:finance`** is also present. No names, contacts, private files, quality candidates or approval records are returned. Existing keys are unchanged; administrators explicitly choose the extra scope. This endpoint is read-only.

Optional filters: `building` (number), `phase` (registered value or `unassigned`), `activity` (registry UUID or `unassigned`), `unit_type`, `from`, `to` (`YYYY-MM-DD`). Defaults are the current month through today in Asia/Riyadh. Response includes `as_of`, normalized `scope`, `inventory`, `pipeline`, and permitted `finance`. Each unavailable section returns `unavailable: true`; it is not zero.

All consumers use public `metrics_*` functions: UI `/dashboard`, legacy API `/stats` and `/stats/overview`, developer `admin-stats`, MCP `stats_overview`, Telegram daily summary and overview/revenue tools. Other endpoints remain record/evidence reads, not competing financial metrics.

- Leased rate: published leased / published, excluding test units.
- Occupancy rate: published (leased + on_hold + pending_contract) / published.
- Annual rent excl VAT: active contracts' rent, or matching contract-unit rent under filters; never unit price or expected building revenue.
- Due: outstanding non-waived installment balances whose due date precedes Riyadh today and falls in the chosen due-date period.
- Overdue: due date more than configured grace days before Riyadh today (initial setting: 3).
- Collected: verified non-reversed approved receipts by actual paid_at in the chosen period. VAT is separate; undocumented VAT stays null.
- Collection rate: verified allocations to installments due in the selected period / their total non-waived obligation (incl VAT consistently). Unallocated receipts are excluded.
- Conversion: distinct documented transitions to pending_contract in period / submitted booking requests in period. Repeated transitions count once; the ratio may exceed 100% when older requests convert.

Inventory, current stages and active contract rent are current snapshots, not historical end-of-period inventory. Zero denominator gives null, not 0%/100%. Receipt attribution follows allocation → installment → contract → scoped contract-unit rent share. Unallocated sums remain explicitly project-level and never spread into a building/activity without allocation evidence. Test-unit shares are excluded consistently.

Coverage: approved finance sources only; **54 historical sources require human review**, no final finance cutover or automatic approval. Comprehensive Prompt 11 quality checks are not implemented and must not be inferred from these metrics.
