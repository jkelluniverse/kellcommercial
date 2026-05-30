# Kell Commercial — Asset Manager

A trimmed, rebranded property-management app modeled after the Nice City Homes
operations console — built fresh on FastAPI + React + MongoDB for simplicity and
maintainability for a 2-user portfolio.

## Original problem statement
> Build a mobile app: the kellcommercial repository contains a copy of another
> web app I've built for Nice City Homes. I need help creating a new app with
> this code base and functionality with some changes. Some features will be
> removed and it will be rebranded for Kell Commercial. It will connect via API
> with a different property management software called Rentec Direct to pull
> live payment data.

User-confirmed scope:
- **Keep:** Dashboard, Properties & Units, Tenants & Leases, Payments (rent
  status), Documents (Drive search), Tasks, Expenses, Utility Accounts, Tenant
  Applications, Directory.
- **Remove:** Messages/chat, Jobs entirely (incl. job expenses), Invoices,
  Placements, Available-Properties, Financial (loan groups), DoorLoop.
- **Branding:** Crimson `#B91C1C` + Gold `#C9A961` on near-black `#0A0A0A`,
  EST. 1978, the Kell Commercial logo.
- **Auth:** Email + password (bcrypt + JWT). One admin (Jacob),
  one viewer (Mike).
- **Property model:** ~25 properties + 1 commercial building with child units.

## Architecture
| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.11), Motor (async Mongo), bcrypt, PyJWT |
| Database | MongoDB |
| Frontend | React 18 + react-router-dom + Tailwind CSS v3 + Lucide icons |
| Auth | Email/password → JWT (7-day) via httpOnly cookie *and* Bearer header |
| Rentec | REST/JSON client with 5-min cache + manual sync endpoint |
| Drive | Google service account, scoped read-only search of the configured folder |
| Email | Gmail SMTP (App Password) for payment-received/overdue notifications |

### Why we rebuilt rather than ported
The original Asset-Manager repo (`Asset-Manager-main.zip`) is a pnpm monorepo
(Express 5 + Drizzle + Postgres + React 19 + Vite + Socket.IO + web-push +
DoorLoop + Replit plugins). Surgically removing NCH/chat/jobs/DoorLoop while
keeping the monorepo compilable would consume the entire build budget on
import-error whack-a-mole, and the user's actual use case (2 users, ~26
properties) is far simpler than what that codebase was built for. Rebuilding on
the simpler, container-native stack delivers a working, deployable app today.

## Personas
- **Jacob (admin)** — Sole editor. Manages properties, units, tenants, leases,
  payments, tasks, expenses, applications; runs Rentec sync.
- **Mike (viewer)** — Read-only access (no write endpoints).

## Core features implemented (2026-05-30)
- [x] Bcrypt + JWT auth, idempotent admin/viewer seeding
- [x] Properties + Units (CRUD, residential & commercial)
- [x] Tenants + Leases (CRUD)
- [x] Payments (manual entry + Rentec snapshot blend)
- [x] Rentec Direct REST client (configurable base URL, 3 auth schemes, paginated)
- [x] Rentec sync + snapshot caching in MongoDB
- [x] Rent-status current-month summary (Rentec-derived)
- [x] Tasks (priority/status kanban)
- [x] Expenses (record-keeping with category, property tagging)
- [x] Utility accounts (public submission + admin list)
- [x] Tenant applications (public submission + admin review workflow)
- [x] Documents — Google Drive folder search via service account
- [x] Email service (Gmail SMTP) — payment-received auto-fires on /api/payments
- [x] Branded UI: crimson red + gold on black, Oswald display font, EST. 1978

## Endpoints (all under `/api`)
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET/POST/PUT/DELETE /properties`, `/properties/{id}/units`, `/units/{id}`
- `GET/POST/PUT/DELETE /tenants`, `/leases`
- `GET/POST /payments`
- `GET /rent-status/summary`
- `GET /rentec/status`, `POST /rentec/sync`, `GET /rentec/snapshot`
- `GET/POST/PUT/DELETE /tasks`
- `GET/POST/DELETE /expenses`
- `POST /public/utility-accounts`, `GET /utility-accounts`
- `POST /public/tenant-applications`, `GET/PUT /tenant-applications`
- `GET /documents/search?q=`, `GET /documents/root`
- `POST /notifications/test`
- `GET /health`

## Configuration (backend/.env)
- `MONGO_URL`, `DB_NAME`
- `JWT_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VIEWER_EMAIL`, `VIEWER_PASSWORD`
- `RENTEC_API_KEY`, `RENTEC_BASE_URL`
- `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` *(JSON string or path)*
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME`
- `FRONTEND_URL` *(for CORS)*

## Known gaps / backlog
- **P0 — Rentec endpoint paths**: My implementation guesses standard REST paths
  (`/properties`, `/units`, `/tenants`, `/leases`, `/payments`). Rentec V3 Open
  API may use different paths/auth header. Confirm with Rentec docs or support
  and tune `backend/rentec.py` (the client tries Bearer, raw, and x-api-key).
- **P0 — Google service account JSON**: User must paste the JSON into
  `GOOGLE_SERVICE_ACCOUNT_JSON` and share the Drive folder with
  `app-drive-service-account@nch-operations-app.iam.gserviceaccount.com`.
- **P0 — Gmail App Password**: User must enable 2FA on `jacob@nicecityhomes.com`,
  create an App Password, and set `GMAIL_APP_PASSWORD`.
- **P1**: Public-facing forms (`/public/apply`, `/public/utilities`) — backend
  endpoints exist; user-facing UI not yet built (admin-side views work).
- **P1**: Scheduled Rentec sync (cron). Currently only manual via dashboard.
- **P2**: PWA install banner (Apple home-screen push), receipt OCR upload, push
  notifications (not requested in this scope).

## Deployment
See `/app/DEPLOY_RAILWAY.md` for step-by-step instructions to deploy the app to
Railway and connect the `kellcommercial.com` domain.
