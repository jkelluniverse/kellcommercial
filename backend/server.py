"""Kell Commercial — FastAPI backend.

Modules:
- /api/auth/*          — email+password JWT auth
- /api/properties      — properties (with units sub-collection)
- /api/tenants, /api/leases
- /api/rent-status     — current month snapshot powered by Rentec
- /api/rentec/*        — manual sync, raw fetches
- /api/payments        — payment history (synced from Rentec + manual entries)
- /api/tasks, /api/expenses
- /api/utility-accounts, /api/tenant-applications  (public + admin)
- /api/documents/*     — Drive search wrapper
- /api/notifications/* — Gmail email helpers
"""
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os
import logging
import asyncio
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

import auth as auth_mod
import models as M
import rentec as rentec_mod
import drive as drive_mod
import email_svc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("kellcommercial")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
if not MONGO_URL or not DB_NAME:
    raise RuntimeError("MONGO_URL and DB_NAME are required")

client: Optional[AsyncIOMotorClient] = None
db = None


async def _seed_users():
    """Idempotent seed of admin + viewer."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "")
    viewer_email = os.environ.get("VIEWER_EMAIL", "").lower()
    viewer_pwd = os.environ.get("VIEWER_PASSWORD", "")
    if not admin_email or not admin_pwd or not viewer_email or not viewer_pwd:
        log.warning("Seed skipped — admin or viewer credentials missing")
        return
    pairs = [
        (admin_email, admin_pwd, "Jacob Kell", "admin"),
        (viewer_email, viewer_pwd, "Mike Kell", "viewer"),
    ]
    for email, pwd, name, role in pairs:
        existing = await db.users.find_one({"email": email})
        hashed = auth_mod.hash_password(pwd)
        if existing is None:
            await db.users.insert_one({
                "email": email,
                "password_hash": hashed,
                "name": name,
                "role": role,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            log.info("Seeded user: %s (%s)", email, role)
        elif not auth_mod.verify_password(pwd, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hashed}})
            log.info("Updated password for: %s", email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.create_index("email", unique=True)
    await db.properties.create_index("id", unique=True)
    await db.units.create_index("id", unique=True)
    await db.tenants.create_index("id", unique=True)
    await db.leases.create_index("id", unique=True)
    await db.payments.create_index("id", unique=True)
    await db.tasks.create_index("id", unique=True)
    await db.expenses.create_index("id", unique=True)
    await db.utility_accounts.create_index("id", unique=True)
    await db.tenant_applications.create_index("id", unique=True)
    await _seed_users()
    log.info("Kell Commercial backend ready")
    yield
    if client is not None:
        client.close()


app = FastAPI(title="Kell Commercial API", lifespan=lifespan)

# CORS is essentially a no-op for same-origin (frontend served from same host
# as the API). We keep it permissive to avoid any preflight edge cases during
# local dev. allow_credentials=False because we use Bearer-token auth, not
# cookies — that lets us safely use a wildcard origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ─── Dependency
async def current_user(request: Request) -> dict:
    return await auth_mod.get_current_user(request, db)


def admin_only(user: dict = Depends(current_user)) -> dict:
    auth_mod.require_admin(user)
    return user


def _strip_mongo(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ─── Health
@api.get("/health")
async def health():
    return {
        "ok": True,
        "rentec_configured": rentec_mod.has_key(),
        "drive_configured": drive_mod.is_configured(),
        "email_configured": email_svc.is_configured(),
    }


# ─── Auth
@api.post("/auth/login")
async def login(body: M.LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not auth_mod.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth_mod.create_access_token(str(user.get("_id", "")), email, user["role"])
    auth_mod.set_auth_cookie(response, token)
    return {
        "user": {
            "id": str(user.get("_id", "")),
            "email": email,
            "name": user["name"],
            "role": user["role"],
        },
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(current_user)):
    auth_mod.clear_auth_cookie(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


# ─── Properties
@api.get("/properties")
async def list_properties(user: dict = Depends(current_user), q: Optional[str] = None):
    cursor = db.properties.find()
    items = [_strip_mongo(p) async for p in cursor]
    if q:
        ql = q.lower()
        items = [p for p in items if ql in (p.get("name", "") + p.get("address", "")).lower()]
    items.sort(key=lambda p: p.get("name", ""))
    return items


@api.post("/properties")
async def create_property(body: M.PropertyIn, user: dict = Depends(admin_only)):
    prop = M.Property(**body.model_dump()).model_dump()
    await db.properties.insert_one({**prop})
    return _strip_mongo(prop)


@api.get("/properties/{property_id}")
async def get_property(property_id: str, user: dict = Depends(current_user)):
    p = await db.properties.find_one({"id": property_id})
    if not p:
        raise HTTPException(404, "Property not found")
    return _strip_mongo(p)


@api.put("/properties/{property_id}")
async def update_property(property_id: str, body: dict = Body(...), user: dict = Depends(admin_only)):
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.properties.update_one({"id": property_id}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Property not found")
    p = await db.properties.find_one({"id": property_id})
    return _strip_mongo(p)


@api.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(admin_only)):
    await db.properties.delete_one({"id": property_id})
    await db.units.delete_many({"property_id": property_id})
    return {"ok": True}


# ─── Units
@api.get("/properties/{property_id}/units")
async def list_units(property_id: str, user: dict = Depends(current_user)):
    cursor = db.units.find({"property_id": property_id})
    return [_strip_mongo(u) async for u in cursor]


@api.post("/properties/{property_id}/units")
async def create_unit(property_id: str, body: M.UnitIn, user: dict = Depends(admin_only)):
    payload = body.model_dump()
    payload["property_id"] = property_id
    unit = M.Unit(**payload).model_dump()
    await db.units.insert_one({**unit})
    return _strip_mongo(unit)


@api.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(admin_only)):
    await db.units.delete_one({"id": unit_id})
    return {"ok": True}


# ─── Tenants
@api.get("/tenants")
async def list_tenants(user: dict = Depends(current_user)):
    cursor = db.tenants.find()
    items = [_strip_mongo(t) async for t in cursor]
    items.sort(key=lambda t: t.get("name", ""))
    return items


@api.post("/tenants")
async def create_tenant(body: M.TenantIn, user: dict = Depends(admin_only)):
    t = M.Tenant(**body.model_dump()).model_dump()
    await db.tenants.insert_one({**t})
    return _strip_mongo(t)


@api.put("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: dict = Body(...), user: dict = Depends(admin_only)):
    await db.tenants.update_one({"id": tenant_id}, {"$set": body})
    t = await db.tenants.find_one({"id": tenant_id})
    if not t:
        raise HTTPException(404, "Tenant not found")
    return _strip_mongo(t)


@api.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, user: dict = Depends(admin_only)):
    await db.tenants.delete_one({"id": tenant_id})
    return {"ok": True}


# ─── Leases
@api.get("/leases")
async def list_leases(user: dict = Depends(current_user)):
    cursor = db.leases.find()
    return [_strip_mongo(l) async for l in cursor]


@api.post("/leases")
async def create_lease(body: M.LeaseIn, user: dict = Depends(admin_only)):
    l = M.Lease(**body.model_dump()).model_dump()
    await db.leases.insert_one({**l})
    return _strip_mongo(l)


@api.delete("/leases/{lease_id}")
async def delete_lease(lease_id: str, user: dict = Depends(admin_only)):
    await db.leases.delete_one({"id": lease_id})
    return {"ok": True}


# ─── Tasks
@api.get("/tasks")
async def list_tasks(user: dict = Depends(current_user)):
    cursor = db.tasks.find()
    items = [_strip_mongo(t) async for t in cursor]
    items.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    return items


@api.post("/tasks")
async def create_task(body: M.TaskIn, user: dict = Depends(admin_only)):
    t = M.Task(**body.model_dump()).model_dump()
    await db.tasks.insert_one({**t})
    return _strip_mongo(t)


@api.put("/tasks/{task_id}")
async def update_task(task_id: str, body: dict = Body(...), user: dict = Depends(admin_only)):
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    if body.get("status") == "done" and "completed_at" not in body:
        body["completed_at"] = body["updated_at"]
    await db.tasks.update_one({"id": task_id}, {"$set": body})
    t = await db.tasks.find_one({"id": task_id})
    return _strip_mongo(t) if t else None


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(admin_only)):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ─── Expenses
@api.get("/expenses")
async def list_expenses(user: dict = Depends(current_user)):
    cursor = db.expenses.find()
    items = [_strip_mongo(e) async for e in cursor]
    items.sort(key=lambda e: e.get("expense_date", ""), reverse=True)
    return items


@api.post("/expenses")
async def create_expense(body: M.ExpenseIn, user: dict = Depends(admin_only)):
    e = M.Expense(submitted_by=user["email"], **body.model_dump()).model_dump()
    await db.expenses.insert_one({**e})
    return _strip_mongo(e)


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(admin_only)):
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}


# ─── Utility accounts (public submission + admin list)
@api.post("/public/utility-accounts")
async def public_utility(body: M.UtilityAccountIn):
    a = M.UtilityAccount(**body.model_dump()).model_dump()
    await db.utility_accounts.insert_one({**a})
    return {"ok": True, "id": a["id"]}


@api.get("/utility-accounts")
async def list_utility(user: dict = Depends(current_user)):
    cursor = db.utility_accounts.find()
    items = [_strip_mongo(u) async for u in cursor]
    items.sort(key=lambda u: u.get("created_at", ""), reverse=True)
    return items


# ─── Tenant applications (public + admin)
@api.post("/public/tenant-applications")
async def public_application(body: M.TenantApplicationIn):
    a = M.TenantApplication(**body.model_dump()).model_dump()
    await db.tenant_applications.insert_one({**a})
    return {"ok": True, "id": a["id"]}


@api.get("/tenant-applications")
async def list_applications(user: dict = Depends(current_user)):
    cursor = db.tenant_applications.find()
    items = [_strip_mongo(a) async for a in cursor]
    items.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return items


@api.put("/tenant-applications/{app_id}")
async def update_application(app_id: str, body: dict = Body(...), user: dict = Depends(admin_only)):
    await db.tenant_applications.update_one({"id": app_id}, {"$set": body})
    a = await db.tenant_applications.find_one({"id": app_id})
    return _strip_mongo(a) if a else None


# ─── Payments (combined: local + Rentec snapshot)
@api.get("/payments")
async def list_payments(user: dict = Depends(current_user)):
    cursor = db.payments.find()
    items = [_strip_mongo(p) async for p in cursor]
    items.sort(key=lambda p: p.get("date", ""), reverse=True)
    return items


@api.post("/payments")
async def add_payment(body: dict = Body(...), user: dict = Depends(admin_only)):
    p = M.PaymentRecord(**body).model_dump()
    await db.payments.insert_one({**p})
    # Fire notification (best-effort)
    if email_svc.is_configured():
        admin = os.environ.get("ADMIN_EMAIL", "")
        viewer = os.environ.get("VIEWER_EMAIL", "")
        recipients = [r for r in [admin, viewer] if r]
        asyncio.create_task(email_svc.send_payment_received(
            recipients,
            p.get("tenant_name") or "Tenant",
            p.get("property_address") or "",
            float(p["amount"]),
            p["date"],
        ))
    return _strip_mongo(p)


# ─── Rentec sync + status
@api.get("/rentec/status")
async def rentec_status(user: dict = Depends(current_user)):
    return await rentec_mod.check_connection()


@api.post("/rentec/sync")
async def rentec_sync(user: dict = Depends(admin_only), force: bool = True):
    """Pull from Rentec and cache the latest snapshot into Mongo for fast UI access."""
    summary = await rentec_mod.sync_all(force=force)
    # Cache the latest snapshot under a singleton key
    await db.rentec_snapshot.update_one(
        {"_singleton": True},
        {"$set": {**summary, "_singleton": True}},
        upsert=True,
    )
    return {"counts": summary["counts"], "synced_at": summary["synced_at"], "configured": summary["configured"]}


@api.get("/rentec/snapshot")
async def rentec_snapshot(user: dict = Depends(current_user)):
    snap = await db.rentec_snapshot.find_one({"_singleton": True})
    if not snap:
        return {"properties": [], "units": [], "tenants": [], "leases": [], "payments": [], "counts": {"properties": 0, "units": 0, "tenants": 0, "leases": 0, "payments": 0}, "synced_at": None, "configured": rentec_mod.has_key()}
    snap.pop("_id", None)
    snap.pop("_singleton", None)
    return snap


@api.get("/rentec/debug-transactions")
async def rentec_debug_transactions(user: dict = Depends(admin_only)):
    """Direct probe of Rentec /transactions. Returns the raw status + body of
    multiple query attempts so we can see exactly what Rentec is sending back.
    """
    import httpx
    from datetime import datetime as _dt, timedelta as _td
    key = os.environ.get("RENTEC_API_KEY", "")
    base = os.environ.get("RENTEC_BASE_URL", "https://secure.rentecdirect.com/api/v3").rstrip("/")
    today = _dt.utcnow().date()
    attempts = [
        {"name": "no-params", "params": {}},
        {"name": "age-30d", "params": {"age": "30d"}},
        {"name": "age-90d", "params": {"age": "90d"}},
        {"name": "explicit-30day-window", "params": {"start_date": (today - _td(days=30)).isoformat(), "end_date": today.isoformat()}},
        {"name": "explicit-365day-window", "params": {"start_date": (today - _td(days=365)).isoformat(), "end_date": today.isoformat()}},
        {"name": "with-page-1", "params": {"page": 1, "age": "30d"}},
    ]
    out = []
    headers = {"X-API-Key": key, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        for a in attempts:
            try:
                r = await client.get(f"{base}/transactions", headers=headers, params=a["params"])
                body_preview = r.text[:400]
                try:
                    j = r.json()
                    if isinstance(j, dict):
                        data = j.get("data")
                        summary = j.get("summary")
                        body_preview = f"summary={summary} | data_len={len(data) if isinstance(data, list) else 'not-list'} | first={data[0] if isinstance(data, list) and data else None}"
                except Exception:
                    pass
                out.append({"attempt": a["name"], "params": a["params"], "status": r.status_code, "body": body_preview})
            except Exception as e:
                out.append({"attempt": a["name"], "params": a["params"], "error": str(e)})
    return {"base_url": base, "key_set": bool(key), "attempts": out}


@api.get("/rentec/raw")
async def rentec_raw(user: dict = Depends(current_user)):
    """Debug — return one sample of each entity so we can see real Rentec field names."""
    snap = await db.rentec_snapshot.find_one({"_singleton": True}) or {}
    return {
        "sample_property": (snap.get("properties") or [None])[0],
        "sample_lease": (snap.get("leases") or [None])[0],
        "sample_tenant": (snap.get("tenants") or [None])[0],
        "sample_transaction": (snap.get("transactions") or [None])[0],
        "counts": snap.get("counts"),
    }


# ─── Rent status — current month summary
@api.get("/rent-status/summary")
async def rent_status_summary(user: dict = Depends(current_user)):
    """Build a current-month rent summary from the Rentec snapshot.

    Rentec's data model (from API V3 spec):
    - `monthly_rent` lives on the PROPERTY, not the lease
    - A lease has `property_id` + `renter_id` + `lease_begin/lease_end` + `balance`
    - A lease is active if `move_out` is null
    - Transactions are in `/transactions` endpoint
    """
    snap = await db.rentec_snapshot.find_one({"_singleton": True}) or {}
    properties = snap.get("properties", [])
    leases = snap.get("leases", [])
    transactions = snap.get("transactions", [])

    # Build a property-id → monthly_rent map
    rent_by_property: dict[int, float] = {}
    for p in properties:
        if not isinstance(p, dict):
            continue
        pid = p.get("property_id") or p.get("id")
        rent = p.get("monthly_rent")
        if pid is not None and isinstance(rent, (int, float)) and rent > 0:
            rent_by_property[pid] = float(rent)

    # Active leases = no move_out date
    total_expected = 0.0
    total_balance_due = 0.0
    active_leases = 0
    leased_property_ids = set()
    for l in leases:
        if not isinstance(l, dict):
            continue
        if l.get("move_out"):
            continue
        active_leases += 1
        pid = l.get("property_id")
        if pid in rent_by_property and pid not in leased_property_ids:
            total_expected += rent_by_property[pid]
            leased_property_ids.add(pid)
        bal = l.get("balance")
        if isinstance(bal, (int, float)) and bal > 0:
            total_balance_due += float(bal)

    # Sum current-month inflows from transactions
    now = datetime.now(timezone.utc)
    month_prefix = f"{now.year}-{now.month:02d}"
    total_collected = 0.0
    paid_count = 0
    for t in transactions:
        if not isinstance(t, dict):
            continue
        d = ""
        for k in ("date", "transaction_date", "tdate", "paymentDate"):
            v = t.get(k)
            if isinstance(v, str) and v:
                d = v
                break
        if not d.startswith(month_prefix):
            continue
        amt = 0.0
        for k in ("amount", "amount_received", "amountReceived", "total"):
            v = t.get(k)
            if isinstance(v, (int, float)):
                amt = float(v)
                break
        if amt > 0:
            total_collected += amt
            paid_count += 1

    collection_rate = round((total_collected / total_expected) * 100, 1) if total_expected > 0 else 0.0

    return {
        "month": now.month,
        "year": now.year,
        "total_expected": round(total_expected, 2),
        "total_collected": round(total_collected, 2),
        "collection_rate": collection_rate,
        "total_balance_due": round(total_balance_due, 2),
        "paid_count": paid_count,
        "lease_count": active_leases,
        "transactions_count": len(transactions),
        "synced_at": snap.get("synced_at"),
        "configured": rentec_mod.has_key(),
    }


# ─── Documents (Drive search)
@api.get("/documents/search")
async def documents_search(q: str = Query(..., min_length=2), user: dict = Depends(current_user)):
    return drive_mod.search(q, max_results=30)


@api.get("/documents/root")
async def documents_root(user: dict = Depends(current_user)):
    return drive_mod.list_root()


# ─── Notifications test
@api.post("/notifications/test")
async def notif_test(user: dict = Depends(admin_only)):
    ok = await email_svc.send_email(
        [user["email"]],
        "Kell Commercial — test notification",
        email_svc._wrap("<p>This is a test notification. If you received this, Gmail SMTP is working.</p>"),
    )
    return {"sent": ok, "configured": email_svc.is_configured()}


app.include_router(api)


# ─── Serve the React build (single-service deployment, like the NCH app) ───
# In production, Railway builds the frontend (`frontend/build/`) and the
# FastAPI process serves it alongside `/api/*`. No separate frontend service.
from pathlib import Path as _Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

_FRONTEND_BUILD = _Path(__file__).parent.parent / "frontend" / "build"

if _FRONTEND_BUILD.exists() and (_FRONTEND_BUILD / "index.html").exists():
    # Static assets (JS, CSS, images): served at /static/*
    app.mount(
        "/static",
        StaticFiles(directory=_FRONTEND_BUILD / "static"),
        name="static",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't intercept /api/* (handled by the router above)
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse({"detail": "Not found"}, status_code=404)
        # Serve specific static files at the root (favicon, manifest, etc.)
        target = _FRONTEND_BUILD / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        # SPA fallback — let React Router handle the route
        return FileResponse(_FRONTEND_BUILD / "index.html")
else:
    log.warning(
        "Frontend build not found at %s — running API-only mode", _FRONTEND_BUILD
    )

    @app.get("/")
    async def root():
        return {"app": "Kell Commercial", "ok": True, "mode": "api-only"}
