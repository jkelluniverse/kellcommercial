# Kell Commercial — Test Credentials

## Admin (full read/write)
- **Email:** `jacob@nicecityhomes.com`
- **Password:** `KellAdmin2026!`
- **Role:** `admin`

## Viewer (read only)
- **Email:** `mikekell@nicecityhomes.com`
- **Password:** `KellViewer2026!`
- **Role:** `viewer`

## How to change a password
Edit `backend/.env`:
```
ADMIN_EMAIL="..."
ADMIN_PASSWORD="..."
VIEWER_EMAIL="..."
VIEWER_PASSWORD="..."
```
Then `sudo supervisorctl restart backend`. The seed script is idempotent and will
update the bcrypt hash in MongoDB on next startup.

## Auth endpoints
- `POST /api/auth/login`  → `{ user, token }` (sets `access_token` cookie)
- `POST /api/auth/logout` → clears cookie
- `GET  /api/auth/me`     → current user (cookie or `Authorization: Bearer <token>`)

## Quick test (curl)
```
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jacob@nicecityhomes.com","password":"KellAdmin2026!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/auth/me
```
