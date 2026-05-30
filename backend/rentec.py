"""Rentec Direct REST/JSON API client with 5-minute caching.

Token format from user: a JWT-like base64 payload — sent in the
Authorization header as: `Authorization: <token>` per Rentec V3 API.
We try Bearer scheme first; on 401 we fall back to raw token.
Returns None on failure so callers can fall back gracefully.
"""
import os
import time
import asyncio
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("rentec")

CACHE_TTL = 300.0  # 5 minutes
REQUEST_TIMEOUT = 15.0
MAX_PAGES = 25
PAGE_SIZE = 100

_cache: dict[str, tuple[float, Any]] = {}


def _api_key() -> Optional[str]:
    k = os.environ.get("RENTEC_API_KEY") or ""
    return k if k else None


def _base_url() -> str:
    return os.environ.get("RENTEC_BASE_URL", "https://secure.rentecdirect.com/api/v1").rstrip("/")


def has_key() -> bool:
    return _api_key() is not None


def clear_cache() -> None:
    _cache.clear()


async def _request(path: str, params: Optional[dict] = None) -> Optional[Any]:
    key = _api_key()
    if not key:
        return None
    url = f"{_base_url()}{path}"
    headers_variants = [
        {"Authorization": f"Bearer {key}", "Accept": "application/json"},
        {"Authorization": key, "Accept": "application/json"},
        {"x-api-key": key, "Accept": "application/json"},
    ]
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        last_err = None
        for headers in headers_variants:
            try:
                r = await client.get(url, headers=headers, params=params or {})
                if r.status_code == 401 or r.status_code == 403:
                    last_err = f"{r.status_code} {r.text[:120]}"
                    continue
                if not r.is_success:
                    logger.warning("Rentec %s %s -> %s", path, params, r.status_code)
                    return None
                ct = r.headers.get("content-type", "")
                if "json" not in ct:
                    logger.warning("Rentec %s non-JSON content-type %s", path, ct)
                    return None
                return r.json()
            except httpx.HTTPError as e:
                logger.error("Rentec request error %s: %s", path, e)
                last_err = str(e)
                return None
        logger.warning("Rentec %s auth failed all schemes: %s", path, last_err)
        return None


async def _list(resource_path: str) -> list[dict]:
    """Fetch all paginated results for a Rentec list resource.

    Returns [] on any error or when no key configured.
    """
    cached = _cache.get(resource_path)
    if cached and (time.time() - cached[0]) < CACHE_TTL:
        return cached[1]

    all_items: list[dict] = []
    for page in range(1, MAX_PAGES + 1):
        body = await _request(resource_path, {"page": page, "pageSize": PAGE_SIZE})
        if body is None:
            return []
        # Rentec response shape varies; try common keys
        items = None
        if isinstance(body, list):
            items = body
        elif isinstance(body, dict):
            for key in ("data", "items", "results", "records"):
                if key in body and isinstance(body[key], list):
                    items = body[key]
                    break
            if items is None:
                # Maybe single-object response
                if "id" in body:
                    items = [body]
        if items is None:
            break
        all_items.extend(items)
        if len(items) < PAGE_SIZE:
            break

    _cache[resource_path] = (time.time(), all_items)
    return all_items


async def get_properties() -> list[dict]:
    return await _list("/properties")


async def get_units() -> list[dict]:
    return await _list("/units")


async def get_tenants() -> list[dict]:
    return await _list("/tenants")


async def get_leases() -> list[dict]:
    return await _list("/leases")


async def get_payments() -> list[dict]:
    return await _list("/payments")


async def get_ledger_entries() -> list[dict]:
    return await _list("/ledgers")


async def sync_all(force: bool = False) -> dict:
    """Fetch everything from Rentec and return a summary dict."""
    if force:
        clear_cache()
    results = await asyncio.gather(
        get_properties(),
        get_units(),
        get_tenants(),
        get_leases(),
        get_payments(),
        return_exceptions=True,
    )

    def safe(idx: int) -> list:
        v = results[idx]
        return v if isinstance(v, list) else []

    properties = safe(0)
    units = safe(1)
    tenants = safe(2)
    leases = safe(3)
    payments = safe(4)

    return {
        "properties": properties,
        "units": units,
        "tenants": tenants,
        "leases": leases,
        "payments": payments,
        "counts": {
            "properties": len(properties),
            "units": len(units),
            "tenants": len(tenants),
            "leases": len(leases),
            "payments": len(payments),
        },
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configured": has_key(),
    }


async def check_connection() -> dict:
    """Ping Rentec to verify credentials. Returns status and any auth hint."""
    if not has_key():
        return {"connected": False, "reason": "RENTEC_API_KEY not set"}
    body = await _request("/properties", {"page": 1, "pageSize": 1})
    if body is None:
        return {"connected": False, "reason": "API returned error or unreachable"}
    return {"connected": True, "reason": "OK"}
