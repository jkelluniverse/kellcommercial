# Rentec Direct v3 — Exact Sync Spec for Kell Commercial

This tells the app precisely what to request to get **properties, account
balances, and amounts paid/unpaid** — accurately and with no wasted calls.

## Connection
- Base URL: `https://secure.rentecdirect.com/api/v3`
- Header on every request: `X-API-Key: <key>`
- Key is created in Rentec at **Settings → Utilities → API Keys**, with **read**
  permission on: properties, tenants, leases, transactions, accounts.
- **Rate limit: 60 requests/minute.** Over that returns `429`. Throttle to
  ~1 req/sec and back off on `429` (honor the `Retry-After` header).

## The three things that make this confusing (fix these and it works)

1. **Balances are already calculated by Rentec — don't sum transactions to get
   "what's owed."**
   - `Tenant.balance` → what that tenant currently owes. **This is your "unpaid" number.**
   - `Lease.balance` and `Lease.deposit_balance` → per-lease balance + deposit held.
   - **`Property` has no balance field.** A property's balance is derived from the
     tenants/leases on it (or from its transaction ledger), never read directly.

2. **`/transactions` takes EXACTLY ONE filter id.** You may pass *one* of
   `property_id`, `renter_id`, `bank_id`, or `category_id`. Passing two returns
   `400`. So you **loop one property (or one tenant) per call.**
   *(Note: a code sample in the spec shows `property_ids=123,124` plural — that
   appears to be a doc error. The defined parameter is singular `property_id`.
   Use singular and loop.)*

3. **`/transactions` is paginated, 300 rows/page, and carries running balances
   in its `summary`.** Read `summary.more_records` / `summary.next_page_url` to
   page through, and `summary.ending_balance` on the **last** page is the
   property's running ledger balance. Rows come oldest-first.

## Exact call sequence

### A. Once at startup / cached
| Call | Purpose |
|---|---|
| `GET /ping` | Verify the key; returns `user_id` + `company`. Do this first. |
| `GET /accounts` | Map `account_id → {name, type}` (type `I`=income, `E`=expense, etc.). Used to read transaction categories. Cache it. |

### B. Portfolio sync (scheduled + manual "Refresh")
| Call | Returns | Notes |
|---|---|---|
| `GET /properties?include_subunits=true&archived=false` | Every property; the Kell building comes back as a `multiplex` with its units in `subunits[]`. | One call. Flatten `subunits[]` so each unit is a row. |
| `GET /tenants?archived=false` | All active tenants **with `balance`** and their linked `properties[]`. | One call = your whole "who owes what" snapshot. |
| `GET /leases` | Current/future leases with `balance` + `deposit_balance`, keyed by `property_id` + `renter_id`. | Pass `start_date`/`end_date` (or `age`) to include past leases. |

### C. Payment detail / ledger (per property, only if you need line items)
For each property id (loop), page through:
```
GET /transactions?property_id={id}&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&page=1
GET /transactions?property_id={id}&...&page=2   # while summary.more_records == true
```
- **Amount paid (in window)** = sum of `amount` on rows that are payments.
- **Amount charged** = sum of `amount` on charge rows.
- **Running balance** = `summary.ending_balance` from the final page.
- *Payment vs charge:* a payment row carries a `pmt_type` (ACH/CH/CA/CR/…); a
  charge typically has none. **Verify this once** against a known tenant's
  ledger in your account, then rely on it.

## Mapping to the app's views
- **Dashboard "owed":** `Tenant.balance` (and/or `Lease.balance`). No transaction math needed.
- **Per-unit / per-property balance:** roll up the balances of tenants on that
  property, or use the property ledger's `ending_balance` from section C.
- **"Paid this month":** section C with the month's `start_date`/`end_date`.

## Efficiency (stay under 60/min)
- Sections A + B are only ~4 calls total — run them on every refresh.
- Section C is one call set per property. For frequent background syncs, add
  `age=2d` so you only pull recent transactions instead of full history; pull
  full history only on first load. Throttle and back off on `429`.

A working implementation of all of the above is in `rentec_client.py`
(`build_portfolio_snapshot()` returns properties + tenant balances + per-property
paid/charged/ending_balance). Give both files to emergent.sh.
