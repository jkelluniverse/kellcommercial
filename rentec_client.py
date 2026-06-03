#!/usr/bin/env python3
"""
rentec_client.py — Rentec Direct API v3 reference client for Kell Commercial
============================================================================

Implements exactly the calls needed to sync: properties, tenants, leases,
account balances, and amounts paid/unpaid. Built straight from the v3 OpenAPI
spec. Hand this to emergent.sh as the working pattern for the sync service.

KEY FACTS baked in (these are the things that trip people up):
  * Base URL: https://secure.rentecdirect.com/api/v3
  * Auth header: X-API-Key: <key>   (key from Settings > Utilities > API Keys,
    with read permissions for properties, tenants, leases, transactions, accounts)
  * Rate limit: 60 requests / minute. Exceed it -> HTTP 429. We throttle + back off.
  * Balances are PRE-COMPUTED by Rentec:
        - Tenant.balance        = what that tenant currently owes (the "unpaid" number)
        - Lease.balance         = balance on that lease
        - Lease.deposit_balance = deposit held
    Property has NO balance field. Do not sum transactions to get "owed".
  * /transactions accepts EXACTLY ONE of {property_id, renter_id, bank_id,
    category_id}. Sending two -> HTTP 400. So you loop one property (or tenant)
    at a time.
  * /transactions is paginated at 300 rows/page. The summary block carries
    starting_balance, ending_balance, more_records, next_page_url, page.
    The last page's ending_balance == the running ledger balance.

Dependency: `requests` (standard for emergent FastAPI backends).
"""

import time
import requests   # pip install requests


class RentecClient:
    BASE = "https://secure.rentecdirect.com/api/v3"

    def __init__(self, api_key, min_interval=1.05, max_retries=4):
        # min_interval ~1.05s keeps us just under 60 req/min.
        self.api_key = api_key
        self.min_interval = min_interval
        self.max_retries = max_retries
        self._last_call = 0.0
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Accept": "application/json",
        })

    # ---- low-level GET with throttle + 429 backoff --------------------------
    def _get(self, path, params=None):
        params = params or {}
        for attempt in range(self.max_retries):
            wait = self.min_interval - (time.time() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            resp = self.session.get(self.BASE + path, params=params, timeout=30)
            self._last_call = time.time()

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError(f"Rate limited repeatedly on {path}")

    # ---- reference / lookup data (cache these) ------------------------------
    def ping(self):
        """Verify the key works. Returns user_id/company. Call this first."""
        return self._get("/ping")["data"]

    def accounts(self):
        """Category map: account_id -> {name, type}. type I=Income, E=Expense,
        O=Other, A=Asset, L=Liability, Q=Equity. Used to classify transactions."""
        rows = self._get("/accounts")["data"]
        return {a["account_id"]: a for a in rows}

    # ---- portfolio entities -------------------------------------------------
    def properties(self, include_subunits=True, archived=False):
        """All properties, with the multi-unit (multiplex) building expanded
        into subunits[]. Returns the full list in one call."""
        return self._get("/properties", {
            "include_subunits": str(include_subunits).lower(),
            "archived": str(archived).lower(),
        })["data"]

    def tenants(self, archived=False):
        """All tenants WITH their current `balance` and linked properties[].
        This single call is your 'who owes what' snapshot."""
        return self._get("/tenants", {"archived": str(archived).lower()})["data"]

    def leases(self, property_id=None, renter_id=None, start_date=None, end_date=None):
        """Leases with balance + deposit_balance. Default = current/future only;
        pass dates to include historical leases."""
        params = {}
        if property_id is not None: params["property_id"] = property_id
        if renter_id is not None:   params["renter_id"] = renter_id
        if start_date:              params["start_date"] = start_date
        if end_date:                params["end_date"] = end_date
        return self._get("/leases", params)["data"]

    # ---- transactions (auto-paginated) --------------------------------------
    def transactions(self, property_id=None, renter_id=None,
                     start_date=None, end_date=None, age=None):
        """Full transaction ledger for ONE property OR ONE tenant.
        Pass exactly one of property_id / renter_id. Auto-paginates.
        Returns (rows, ending_balance) where ending_balance is the running
        ledger balance after the last row."""
        if (property_id is None) == (renter_id is None):
            raise ValueError("Pass exactly ONE of property_id or renter_id.")
        base_params = {}
        if property_id is not None: base_params["property_id"] = property_id
        if renter_id is not None:   base_params["renter_id"] = renter_id
        if start_date:              base_params["start_date"] = start_date
        if end_date:                base_params["end_date"] = end_date
        if age:                     base_params["age"] = age

        rows, ending_balance, page = [], None, 1
        while True:
            params = dict(base_params, page=page)
            payload = self._get("/transactions", params)
            rows.extend(payload.get("data", []))
            summary = payload.get("summary", {})
            ending_balance = summary.get("ending_balance", ending_balance)
            if not summary.get("more_records"):
                break
            page += 1
        return rows, ending_balance

    # ---- debug / probe mode -------------------------------------------------
    def raw_get(self, path, params=None):
        """Like _get but NEVER raises on 4xx/5xx and NEVER hides the body.
        Returns status + raw body so you can see exactly what the API said.
        Throttles to respect the 60/min limit. Key stays in the header, never
        in the returned data."""
        params = params or {}
        wait = self.min_interval - (time.time() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        resp = self.session.get(self.BASE + path, params=params, timeout=30)
        self._last_call = time.time()
        body = resp.text or ""
        if self.api_key in body:                  # defensive: never echo the key
            body = body.replace(self.api_key, "***REDACTED***")
        return {
            "status": resp.status_code,
            "url": resp.url,                      # key is in header, not URL
            "rate_remaining": resp.headers.get("X-RateLimit-Remaining"),
            "retry_after": resp.headers.get("Retry-After"),
            "body": body[:2000],                  # truncate noisy payloads
        }

    def debug_probe(self, property_id, renter_id=None):
        """Hit every documented /transactions variant (plus the core reads) and
        dump raw status + body for each. Wire this to your admin-only debug
        route. Settles the spec's ambiguities against your real account."""
        rid = renter_id if renter_id is not None else 1
        probes = [
            ("auth: /ping",                       "/ping",          {}),
            ("read: /accounts",                   "/accounts",      {}),
            ("read: /properties (+subunits)",     "/properties",    {"include_subunits": "true", "archived": "false"}),
            ("read: /tenants (check balance)",    "/tenants",       {"archived": "false"}),
            ("read: /leases",                     "/leases",        {}),
            ("txn: no filter (expect 400)",       "/transactions",  {}),
            ("txn: property_id singular",         "/transactions",  {"property_id": property_id}),
            ("txn: property_ids plural (doc ex)", "/transactions",  {"property_ids": property_id}),
            ("txn: two filters (expect 400)",     "/transactions",  {"property_id": property_id, "renter_id": rid}),
            ("txn: page=1 (check summary)",       "/transactions",  {"property_id": property_id, "page": 1}),
            ("txn: by renter_id",                 "/transactions",  {"renter_id": rid}),
        ]
        results = []
        for label, path, params in probes:
            try:
                r = self.raw_get(path, params)
            except Exception as e:               # network/timeout, not HTTP status
                r = {"status": "EXC", "error": str(e)}
            results.append({"label": label, "path": path, "params": params, **r})
        return results


def print_probe(results):
    """Pretty one-line-per-probe summary for a terminal or log."""
    for r in results:
        head = r["body"][:140].replace("\n", " ") if "body" in r else r.get("error", "")
        print(f"[{str(r['status']):>3}] {r['label']:<34} {r['path']}{_qs(r['params'])}")
        print(f"      {head}")


def _qs(params):
    return ("?" + "&".join(f"{k}={v}" for k, v in params.items())) if params else ""


# ---------------------------------------------------------------------------
# Snapshot builder: produces exactly what the dashboard needs.
# ---------------------------------------------------------------------------
def is_payment(txn):
    """Heuristic: a tenant PAYMENT carries a payment type (pmt_type) such as
    ACH/CH/CA/CR; a CHARGE (rent billed) has no pmt_type. VERIFY this once
    against a known tenant ledger in your account, then trust it."""
    return bool(txn.get("pmt_type"))


def build_portfolio_snapshot(client, start_date=None, end_date=None):
    """Returns a normalized dict ready to store/sync to the app:
        {
          'properties': [...flattened, incl. subunits...],
          'tenant_balances': {renter_id: balance_owed},
          'property_ledger': {property_id: {ending_balance, paid, charged}},
        }
    'unpaid / owed' comes from tenant/lease balance (Rentec-computed).
    'paid' comes from summing payment transactions in the date window.
    """
    # 1) reference + entities (few calls)
    props = client.properties(include_subunits=True, archived=False)
    tenants = client.tenants(archived=False)

    # flatten subunits so each leasable unit is its own row
    flat = []
    def walk(p):
        flat.append(p)
        for sub in p.get("subunits", []) or []:
            walk(sub)
    for p in props:
        walk(p)

    tenant_balances = {t["renter_id"]: t.get("balance", 0) for t in tenants}

    # 2) per-property ledger (one call set per property; respects rate limit)
    property_ledger = {}
    for p in flat:
        pid = p["property_id"]
        rows, ending = client.transactions(
            property_id=pid, start_date=start_date, end_date=end_date)
        paid = sum(r.get("amount", 0) for r in rows if is_payment(r))
        charged = sum(r.get("amount", 0) for r in rows if not is_payment(r))
        property_ledger[pid] = {
            "ending_balance": ending,   # running ledger balance
            "paid": paid,               # money received in window
            "charged": charged,         # amounts billed in window
            "txn_count": len(rows),
        }

    return {
        "properties": flat,
        "tenant_balances": tenant_balances,
        "property_ledger": property_ledger,
    }


if __name__ == "__main__":
    import os, json
    key = os.environ.get("RENTEC_API_KEY")
    if not key:
        raise SystemExit("Set RENTEC_API_KEY first.")
    c = RentecClient(key)
    print("Auth:", c.ping())
    snap = build_portfolio_snapshot(c, start_date="2026-01-01", end_date="2026-12-31")
    print(json.dumps(snap["property_ledger"], indent=2))
