# Kell Commercial — Asset Manager

A lightweight, **read-only** companion app for tracking the Kell Commercial
portfolio's payments, tenants, and tasks. Built on FastAPI + React + MongoDB,
with live data pulled from Rentec Direct. It never writes back to Rentec.

## Quick start (local)
```bash
# 1. Configure
cp .env.example backend/.env   # then fill in real values

# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd frontend
yarn install
yarn start
```

Sign in at <http://localhost:3000> with the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
you set in `backend/.env`.

## Sections

1. **Dashboard** — Payment status at a glance: who's past due and by how much,
   current-month collection, and open tasks.
2. **Payments** — Live Rentec Direct snapshot of payments, with manual entries.
3. **Tenants** — Tenant directory with each tenant's payment situation
   (balance / past-due) front and center.
4. **Properties & Units** — Portfolio plus the Kell Commercial building modeled
   as one property with multiple child units.
5. **Tasks** — Personal task list with priority and property tagging.

## Configuration

All configuration is via environment variables — see [`.env.example`](.env.example).
Key secrets to set: `JWT_SECRET`, `ADMIN_PASSWORD`, `VIEWER_PASSWORD`,
`RENTEC_API_KEY`, and (optional) `GMAIL_USER` / `GMAIL_APP_PASSWORD`.

## Rentec Direct sync

Read-only against the v3 API (header `X-API-Key`), throttled under the 60
req/min limit. A background job refreshes the cached snapshot every
`RENTEC_SYNC_INTERVAL_MIN` minutes, and the **Refresh** button triggers a sync
on demand. Amounts owed come from Rentec's pre-computed `Tenant.balance` /
`Lease.balance` — never summed from transactions. See
[`RENTEC_SYNC_SPEC.md`](RENTEC_SYNC_SPEC.md).

## Deployment

See [`DEPLOY_RAILWAY.md`](DEPLOY_RAILWAY.md) for Railway deployment.

## Branding

- Color palette: brand red `#A8201A`, gold `#C9A961`, near-black `#0A0A0A` on white.
- Display font: Oswald. Body font: Inter.
- Logo: `assets/kellcommercial-logo.svg` (served from `frontend/public/`,
  referenced via `LOGO_URL` in `frontend/src/lib/api.js`).
