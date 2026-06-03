# CLAUDE.md — Kell Commercial

Project context for Claude Code. Read this fully at the start of every session.

## What this project is
This repo (`kellcommercial`) is a **duplicate of the Nice City Homes (NCH) app**,
being transformed into a **lighter, rebranded app called "Kell Commercial."**
It serves a personal/family property portfolio: ~25 existing personal properties
**plus** one new Kell Commercial building that has multiple leasable units.

Scope is intentionally small — only three jobs:
1. Record keeping (properties, units, tenants, leases, documents)
2. Task organization
3. Payment tracking (from Rentec Direct)

Reuse the existing working code. Do not rebuild from scratch.

## RULE #1 — data separation (non-negotiable)
**This app must contain ZERO Nice City Homes data, branding, or references.**
Kell Commercial is a completely separate entity from NCH. NCH data and Kell
Commercial data must never touch — no shared records, names, addresses, phone
numbers, logos, colors, loan-group labels, seed data, env vars, or links.
If you are ever unsure whether something is NCH-specific, remove it.

Before treating the rebrand as done, run the audit and resolve **every** hit:
```
python3 kc_build.py scan .            # read-only audit -> NCH_AUDIT_REPORT.md
python3 kc_build.py scan . --apply    # apply only the safe brand-string swaps
```
The SAFE count must reach 0; resolve every REVIEW item by hand; replace any
flagged binary logo asset with the Kell Commercial logo.

## Files already in this repo (built and tested — start from these)
- `kc_build.py` — NCH scrubber/auditor + artifact generator. Run it first.
- `rentec_client.py` — working Rentec Direct v3 API client + `build_portfolio_snapshot()` + `debug_probe()`.
- `RENTEC_SYNC_SPEC.md` — exact endpoint/query spec for the sync.
- `.env.example`, `brand.config.json` — config templates.

## Build plan
1. **Audit/strip** — run the scrubber; remove NCH branding and any modules not
   needed for the three jobs above (investor/turnkey/sales features, loan-group
   R1/R2/R3 logic, contractor/subcontractor modules, NCH-tied DoorLoop
   integration, multi-role complexity, NCH seed/demo data).
2. **Rebrand** — name → "Kell Commercial"; replace logo; replace the old crimson
   `#8B0000` with the brand color (default `#1B2A4A` navy — `[FILL IN: confirm]`);
   update titles, favicon, email headers/footers, metadata.
3. **Data model** — portfolio of ~25 properties **plus** the Kell building modeled
   as one property with multiple child units (each unit has its own
   tenant/lease/payment history). No NCH concepts.
4. **Rentec sync** — see below.
5. **Drive documents** — connect the Documents module to one Google Drive folder
   (`GOOGLE_DRIVE_FOLDER_ID`); attach documents to a property or unit.
6. **Access & notifications** — see below.

## Rentec Direct integration (the core of payment tracking)
Use `rentec_client.py`; full detail in `RENTEC_SYNC_SPEC.md`. Key facts:
- Base `https://secure.rentecdirect.com/api/v3`; auth header `X-API-Key`; key from
  Rentec Settings → Utilities → API Keys with read perms on properties, tenants,
  leases, transactions, accounts. Store as the `RENTEC_API_KEY` secret.
- **Rate limit 60 req/min** — throttle ~1/sec and back off on 429.
- **Balances are pre-computed by Rentec; do not sum transactions to get "owed":**
  `Tenant.balance` is what a tenant owes; `Lease.balance` / `deposit_balance` per
  lease. `Property` has no balance field.
- **`/transactions` takes exactly ONE filter id** (`property_id` OR `renter_id`,
  never both → 400) and is **paginated at 300/page**; the last page's
  `summary.ending_balance` is the running ledger balance.
- Sync sequence: `/ping` → `/accounts` (cache) → `/properties?include_subunits=true`
  → `/tenants` → `/leases` → per-property `/transactions` only when line items are
  needed. `build_portfolio_snapshot()` already does this.
- Payment vs charge heuristic: a payment row has a `pmt_type`; a charge does not.
  Verify once against a known tenant via `debug_probe()` before relying on it.

## Access & notifications
- Single admin/editor: `jacob@nicecityhomes.com` — the only account that can edit.
- One view-only user (Dad): read-only, `[FILL IN: Dad's email]`.
- Email notifications for payment-received and payment-overdue to both, toggleable.

## Conventions
- Keep it simple and maintainable — one editor, lighter is better.
- **Never commit secrets.** All keys/credentials live in env/secrets, not code.
  Confirm `.env` is gitignored; only `.env.example` is committed.
- Prefer small, focused commits with clear messages.
- Respect the Rentec rate limit in any new code that calls the API.

## Pre-commit checklist
- [ ] `kc_build.py scan .` shows 0 SAFE hits and all REVIEW items resolved
- [ ] No NCH name/logo/color/address/phone/loan-group/seed data anywhere
- [ ] No secrets or API keys in tracked files
- [ ] Rentec calls stay within 60/min and handle 429
- [ ] Only the five core areas remain: Properties & Units · Tenants & Leases · Payments · Documents · Tasks
