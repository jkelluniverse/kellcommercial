# Kell Commercial — Asset Manager

A trimmed, rebranded property-management app for Kell Commercial. Built on
FastAPI + React + MongoDB.

## Quick start (local)
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd frontend
yarn install
yarn start
```

Sign in at <http://localhost:3000> with the credentials in
[`memory/test_credentials.md`](memory/test_credentials.md).

## Sections

1. **Dashboard** — Portfolio overview, current-month rent collection, recent tasks, integration status.
2. **Properties & Units** — Residential portfolio + Kell Commercial building (one property, many child units).
3. **Tenants & Leases** — Tenant directory, active leases, deposits, rent terms.
4. **Payments** — Rentec Direct snapshot + manual entries; fires Gmail
   notifications.
5. **Documents** — Searches the Google Drive folder via service account.
6. **Tasks** — Kanban-style task tracker with priority and property tagging.
7. **Expenses** — Bookkeeping for non-job expenses.
8. **Utility Accounts** — Tenant-submitted utility provider records (admin view).
9. **Applications** — Tenant applications submitted via the public form.

## Configuration

See [`memory/PRD.md`](memory/PRD.md) for the full feature list, env vars, and
known gaps.

## Deployment

See [`DEPLOY_RAILWAY.md`](DEPLOY_RAILWAY.md) for step-by-step Railway
deployment and how to connect the `kellcommercial.com` domain.

## Branding

- Color palette: crimson `#B91C1C`, gold `#C9A961`, near-black `#0A0A0A`.
- Display font: Oswald (free, Google Fonts).
- Body font: Inter.
- Logo asset: rendered from `frontend/src/lib/api.js`'s `LOGO_URL`.
