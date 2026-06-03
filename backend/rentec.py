"""Rentec Direct Open API V3 client.

Spec: https://secure.rentecdirect.com/api/v3/docs/
- Auth: X-API-Key: <token>  (primary), Bearer also accepted
- Base: https://secure.rentecdirect.com/api/v3
- Response envelope: { "summary": {...}, "data": [...] | {...} }
- Units are subunits of properties (use ?include_subunits=true on /properties)
- /transactions is the rent/ledger endpoint (paginated, 300/page)
- Other list endpoints (/properties, /tenants, /leases) return all rows
"""
import os
import time
import asyncio
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("rentec")

CACHE_TTL = 300.0  # 5 minutes
REQUEST_TIMEOUT = 20.0
MAX_TX_PAGES = 50

_cache: dict[str, tuple[float, Any]] = {}


def _api_key() -> Optional[str]:
    k = (os.environ.get("RENTEC_API_KEY") or "").strip()
    return k or None


def _base_url() -> str:
    return os.environ.get(
        "RENTEC_BASE_URL", "https://secure.rentecdirect.com/api/v3"
    ).rstrip("/")


def has_key() -> bool:
    return _api_key() is not None


def clear_cache() -> None:
    _cache.clear()


async def _request(path: str, params: Optional[dict] = None) -> Optional[dict]:
    key = _api_key()
    if not key:
        return None
    url = f"{_base_url()}{path}"
    headers = {
        "X-API-Key": key,
        "Authorization": f"Bearer {key}",  # both, just in case
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            r = await client.get(url, headers=headers, params=params or {})
        if not r.is_success:
            logger.warning("Rentec %s %s -> %s %s", path, params, r.status_code, r.text[:150])
            return None
        return r.json()
    except httpx.HTTPError as e:
        logger.error("Rentec %s error: %s", path, e)
        return None


def _unwrap(body: Optional[dict]) -> list[dict]:
    """Extract `data` array from the Rentec summary+data envelope."""
    if not body or not isinstance(body, dict):
        return []
    data = body.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


async def _cached_list(cache_key: str, path: str, params: dict) -> list[dict]:
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached[0]) < CACHE_TTL:
        return cached[1]
    body = await _request(path, params)
    items = _unwrap(body)
    _cache[cache_key] = (time.time(), items)
    return items


# ─── Public list endpoints (no pagination) ─────────────────────────────────
async def get_properties(include_subunits: bool = True) -> list[dict]:
    return await _cached_list(
        f"properties:{include_subunits}",
        "/properties",
        {"include_subunits": "true" if include_subunits else "false"},
    )


async def get_tenants() -> list[dict]:
    return await _cached_list("tenants", "/tenants", {})


async def get_leases() -> list[dict]:
    return await _cached_list("leases", "/leases", {})


# ─── Transactions (paginated, 300/page) ───────────────────────────────────
# Rentec REQUIRES one of property_id / renter_id / bank_id / category_id per
# call. We iterate the property list and aggregate, with a per-property cache.
async def _transactions_for_property(prop_id: int, age: str) -> list[dict]:
    all_rows: list[dict] = []
    for page in range(1, MAX_TX_PAGES + 1):
        body = await _request(
            "/transactions",
            {"property_id": prop_id, "age": age, "page": page},
        )
        if not body:
            break
        rows = _unwrap(body)
        all_rows.extend(rows)
        summary = (body or {}).get("summary") or {}
        if not rows or not summary.get("more_records"):
            break
    if all_rows:
        logger.info("Rentec transactions[property_id=%s, age=%s]: %d rows", prop_id, age, len(all_rows))
    return all_rows


async def get_transactions(age: str = "365d") -> list[dict]:
    """Pull transactions across all properties (Rentec requires a scoping filter)."""
    cache_key = f"transactions:{age}"
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached[0]) < CACHE_TTL:
        return cached[1]

    properties = await get_properties(include_subunits=True)
    prop_ids: list[int] = []
    for p in properties:
        if isinstance(p, dict):
            pid = p.get("property_id") or p.get("id")
            if isinstance(pid, int):
                prop_ids.append(pid)

    if not prop_ids:
        return []

    # Fetch in parallel batches (10 at a time to be polite to the API)
    BATCH = 10
    all_rows: list[dict] = []
    for i in range(0, len(prop_ids), BATCH):
        batch = prop_ids[i:i + BATCH]
        results = await asyncio.gather(
            *[_transactions_for_property(pid, age) for pid in batch],
            return_exceptions=True,
        )
        for r in results:
            if isinstance(r, list):
                all_rows.extend(r)

    logger.info("Rentec aggregated transactions: %d rows across %d properties", len(all_rows), len(prop_ids))
    _cache[cache_key] = (time.time(), all_rows)
    return all_rows


# ─── Sync everything ──────────────────────────────────────────────────────
async def sync_all(force: bool = False) -> dict:
    if force:
        clear_cache()
    results = await asyncio.gather(
        get_properties(include_subunits=True),
        get_tenants(),
        get_leases(),
        get_transactions(),
        return_exceptions=True,
    )

    def safe(idx: int) -> list:
        v = results[idx]
        return v if isinstance(v, list) else []

    properties = safe(0)
    tenants = safe(1)
    leases = safe(2)
    transactions = safe(3)

    # Units are subunits of properties — flatten them out for convenience.
    units: list[dict] = []
    for p in properties:
        for sub in (p.get("subunits") or []):
            units.append({**sub, "parent_property_id": p.get("id")})

    payments = transactions  # show all transactions; the dashboard slices them

    return {
        "properties": properties,
        "units": units,
        "tenants": tenants,
        "leases": leases,
        "transactions": transactions,
        "payments": payments,
        "counts": {
            "properties": len(properties),
            "units": len(units),
            "tenants": len(tenants),
            "leases": len(leases),
            "transactions": len(transactions),
            "payments": len(payments),
        },
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configured": has_key(),
    }


async def check_connection() -> dict:
    """Hit /ping (auth-protected) to verify the key."""
    if not has_key():
        return {"connected": False, "reason": "RENTEC_API_KEY not set"}
    body = await _request("/ping")
    if body is None:
        # Try /properties as fallback ping
        body = await _request("/properties", {"data_only": "true"})
        if body is None:
            return {"connected": False, "reason": "API returned error or unreachable"}
    return {"connected": True, "reason": "OK"}
