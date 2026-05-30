# Deploying Kell Commercial to Railway + kellcommercial.com

This guide walks you through standing up a new Railway project for Kell
Commercial, attaching MongoDB, deploying the backend + frontend, and pointing
**kellcommercial.com** at it.

---

## 1. Create the Railway project

1. Go to <https://railway.app> and click **New Project**.
2. Pick **"Deploy from GitHub repo"** (recommended) and select the repo where
   this code lives. *(If you haven't pushed yet, use the "Save to GitHub"
   feature in the Emergent chat input.)*
3. Name the project **`kellcommercial`**.

When the project opens you'll see an empty canvas with the GitHub service.

---

## 2. Add MongoDB

Railway has a one-click MongoDB plugin.

1. In your project, click **+ New → Database → Add MongoDB**.
2. Wait ~30 seconds for it to provision.
3. Click the new MongoDB service. Under **Variables**, you'll see
   `MONGO_URL` (a.k.a. `MONGODB_URL`) auto-generated.
4. *(Skip this step if you want a fresh DB.)* If you have any existing data to
   import, use `mongodump` / `mongorestore` against the connection string.

> **Alternative:** Use MongoDB Atlas free tier and just paste its connection
> string into the backend's `MONGO_URL` variable. Either approach works.

---

## 3. Deploy the backend

The backend is the FastAPI app in `/backend`.

### 3a. Create the backend service
1. Click **+ New → GitHub Repo → (your repo)**.
2. After it's created, open the service → **Settings**.
3. Set **Root Directory** to `backend`.
4. Set **Start Command** to:
   ```
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
5. Set **Watch Paths** to `backend/**` so the service redeploys only on backend
   changes.

### 3b. Backend environment variables
Open the backend service → **Variables** and add:

| Variable | Value |
|---|---|
| `MONGO_URL` | Reference the Mongo plugin: click **Reference Variable → MongoDB.MONGO_URL** |
| `DB_NAME` | `kellcommercial` |
| `JWT_SECRET` | Run `openssl rand -hex 32` locally and paste the output |
| `ADMIN_EMAIL` | `jacob@nicecityhomes.com` |
| `ADMIN_PASSWORD` | a strong password you choose |
| `VIEWER_EMAIL` | `mikekell@nicecityhomes.com` |
| `VIEWER_PASSWORD` | a strong password you choose |
| `RENTEC_API_KEY` | your Rentec Open API key from Settings → Utilities → API Keys |
| `RENTEC_BASE_URL` | `https://secure.rentecdirect.com/api/v1` *(verify with Rentec docs)* |
| `GOOGLE_DRIVE_FOLDER_ID` | `1Wq0VQOi3Vb57Ij0oHyxljyADapBgr2DY` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | paste the **entire** service-account JSON content as one line |
| `GMAIL_USER` | `jacob@nicecityhomes.com` |
| `GMAIL_APP_PASSWORD` | a 16-char Gmail App Password (see step 5) |
| `EMAIL_FROM_NAME` | `Kell Commercial` |
| `FRONTEND_URL` | `https://kellcommercial.com` *(set after step 4)* |

### 3c. Deploy
Click **Deploy**. Watch the logs — you should see:
```
Seeded user: jacob@nicecityhomes.com (admin)
Seeded user: mikekell@nicecityhomes.com (viewer)
Kell Commercial backend ready
INFO:     Uvicorn running on http://0.0.0.0:XXXX
```

In the service **Settings → Networking**, click **Generate Domain** to get a
temporary URL like `https://kellcommercial-backend.up.railway.app`. Hit
`/api/health` — you should get `{"ok":true,...}`.

---

## 4. Deploy the frontend

### 4a. Create the frontend service
1. **+ New → GitHub Repo → (same repo)**.
2. Open the new service → **Settings**.
3. Set **Root Directory** to `frontend`.
4. Set **Build Command** to:
   ```
   yarn install && yarn build
   ```
5. Set **Start Command** to serve the static build:
   ```
   npx serve -s build -l $PORT
   ```
   *(Add a dev-dependency on `serve` to `package.json`, or use any static server.)*

### 4b. Frontend environment variables
| Variable | Value |
|---|---|
| `REACT_APP_BACKEND_URL` | the backend's Railway URL from step 3c, e.g. `https://kellcommercial-backend.up.railway.app` |

When the build runs, Create React App bakes this into the JS bundle. Anytime you
rotate the backend domain, redeploy the frontend.

### 4c. Deploy & test
Hit the generated frontend URL → you should see the login page. Sign in with the
admin credentials you set.

---

## 5. Gmail App Password (5 min)

1. Sign in to `jacob@nicecityhomes.com` at <https://myaccount.google.com/>.
2. Security → **2-Step Verification** → turn it on if not already.
3. Once 2FA is on, go to <https://myaccount.google.com/apppasswords>.
4. App: **Mail**, Device: **Other (Kell Commercial)** → **Generate**.
5. Copy the 16-character password (spaces don't matter).
6. Paste into Railway → backend service → `GMAIL_APP_PASSWORD`.
7. Redeploy backend.

Test from inside the app: log in as admin, then `POST /api/notifications/test`
(curl or the in-app test button, if added) — you should receive a styled test
email.

---

## 6. Google Drive — share the folder

1. Open the Drive folder `1Wq0VQOi3Vb57Ij0oHyxljyADapBgr2DY` in a browser.
2. Click **Share** → add `app-drive-service-account@nch-operations-app.iam.gserviceaccount.com`
   with **Viewer** permission.
3. Make sure the `GOOGLE_SERVICE_ACCOUNT_JSON` variable on Railway is the full
   one-line JSON for that service account. Get it from GCP Console →
   IAM & Admin → Service Accounts → (the account) → Keys → Add Key → Create New
   Key → JSON.

Test from inside the app: Documents → search for any term.

---

## 7. Connect the kellcommercial.com domain

### 7a. In Railway
1. Open the **frontend service** → **Settings → Networking → Custom Domain**.
2. Enter `kellcommercial.com` → Railway gives you a `CNAME` target like
   `kellcommercial-frontend.up.railway.app` (or an A record).
3. *(Optional but recommended)* Also add `www.kellcommercial.com` and set it to
   redirect to the apex domain.
4. Repeat for the **backend service** but use a subdomain such as
   `api.kellcommercial.com`. Update the frontend's `REACT_APP_BACKEND_URL` to
   `https://api.kellcommercial.com` and the backend's `FRONTEND_URL` to
   `https://kellcommercial.com`, then redeploy both.

### 7b. In your DNS registrar (where kellcommercial.com is registered)
Add the records Railway shows you. Typical setup:

| Type | Host / Name | Value | TTL |
|---|---|---|---|
| `A` or `ALIAS`/`ANAME` | `@` (apex) | the value Railway provides | 3600 |
| `CNAME` | `www` | `kellcommercial.com.` | 3600 |
| `CNAME` | `api` | `kellcommercial-backend.up.railway.app.` | 3600 |

(If your registrar doesn't support `ALIAS`/`ANAME` for the apex, use
Cloudflare or set up `www.` as the canonical and 301 redirect the apex.)

### 7c. SSL
Railway auto-issues Let's Encrypt certificates for each custom domain. It
usually completes within a few minutes once the DNS resolves.

---

## 8. Post-launch checklist

- [ ] `https://kellcommercial.com` loads the login screen with the KELL logo.
- [ ] Admin login (Jacob) lets you create properties, units, tenants, leases.
- [ ] Viewer login (Mike) is read-only (the New / Edit buttons hide).
- [ ] Dashboard **Sync Rentec** button returns counts > 0
      *(if 0: confirm `RENTEC_BASE_URL` matches Rentec docs)*.
- [ ] Documents search returns Drive results.
- [ ] Manually adding a payment fires the Gmail notification to both users.

---

## 9. Updating the app

Any push to the connected GitHub branch redeploys the relevant service
automatically (Railway watches the **Root Directory**). For data-only changes
(e.g., seeding new properties) you can either:
- Use the in-app forms (admin → New Property), or
- `mongosh` against the Mongo connection string and bulk-insert.

---

## 10. Cost estimate

For a 2-user portfolio:
- Railway Hobby plan: $5/mo includes ~500 hours of execution and 1 GB RAM.
- MongoDB plugin: ~$5/mo for the smallest tier (or free on Atlas free tier).
- Custom domain SSL: free.
- Total: **~$10/mo**.

---

## Troubleshooting

**Backend won't start:** check that `JWT_SECRET`, `MONGO_URL`, `DB_NAME` are all
set. The app fails fast if any required env var is missing.

**Frontend can't reach API (CORS error):** verify `FRONTEND_URL` on the backend
matches the exact origin (scheme + host, no trailing slash) the browser sees,
and that the frontend's `REACT_APP_BACKEND_URL` points at the backend's domain.

**Rentec sync returns 0 properties:** the V3 Open API endpoint paths may not
match the defaults. Open `backend/rentec.py` and adjust `_list()` resource paths
to match the official Rentec OpenAPI spec (look in your Rentec Utilities →
API Keys → "View Open API Documentation").

**Drive search returns "Drive not configured":** double-check that
`GOOGLE_SERVICE_ACCOUNT_JSON` is the full JSON (starts with `{` and ends with
`}`) and that the Drive folder is shared with the service account email.

**Gmail "Username and Password not accepted":** App Password not set or wrong.
Regenerate at <https://myaccount.google.com/apppasswords>.
