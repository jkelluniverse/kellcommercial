"""Google Drive search via service account.

The folder MUST be shared with the service account email
(`GOOGLE_SERVICE_ACCOUNT_JSON` -> `client_email`).
Set `GOOGLE_SERVICE_ACCOUNT_JSON` to either the JSON string or a path
to a .json file.
"""
import os
import json
import logging
from typing import Optional
from functools import lru_cache

logger = logging.getLogger("drive")


def _load_credentials():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or ""
    if not raw:
        return None
    try:
        if raw.strip().startswith("{"):
            info = json.loads(raw)
        elif os.path.isfile(raw):
            with open(raw, "r") as f:
                info = json.load(f)
        else:
            return None
        from google.oauth2 import service_account  # type: ignore
        return service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
        )
    except Exception as e:
        logger.error("Failed to load Drive credentials: %s", e)
        return None


@lru_cache(maxsize=1)
def _drive_service():
    creds = _load_credentials()
    if not creds:
        return None
    try:
        from googleapiclient.discovery import build  # type: ignore
        return build("drive", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error("Failed to build Drive service: %s", e)
        return None


def is_configured() -> bool:
    return _drive_service() is not None and bool(os.environ.get("GOOGLE_DRIVE_FOLDER_ID"))


def _folder_id() -> str:
    return os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")


def _escape(q: str) -> str:
    return q.replace("\\", "\\\\").replace("'", "\\'")


def list_root(max_results: int = 100) -> dict:
    svc = _drive_service()
    if not svc:
        return {"configured": False, "files": [], "error": "Drive not configured"}
    folder = _folder_id()
    if not folder:
        return {"configured": False, "files": [], "error": "GOOGLE_DRIVE_FOLDER_ID not set"}
    try:
        resp = svc.files().list(
            q=f"'{folder}' in parents and trashed = false",
            fields="files(id,name,mimeType,webViewLink,modifiedTime,size,parents)",
            orderBy="name",
            pageSize=max_results,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        return {"configured": True, "files": resp.get("files", [])}
    except Exception as e:
        logger.error("Drive list_root error: %s", e)
        return {"configured": True, "files": [], "error": str(e)}


def _bfs_descendants(folder_id: str, svc, max_depth: int = 6) -> set[str]:
    descendants = {folder_id}
    frontier = [folder_id]
    depth = 0
    while frontier and depth < max_depth:
        next_frontier: list[str] = []
        for parent in frontier:
            try:
                resp = svc.files().list(
                    q=f"'{parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                    fields="files(id,name)",
                    pageSize=200,
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                ).execute()
                for f in resp.get("files", []):
                    fid = f.get("id")
                    if fid and fid not in descendants:
                        descendants.add(fid)
                        next_frontier.append(fid)
            except Exception as e:
                logger.warning("BFS list error under %s: %s", parent, e)
        frontier = next_frontier
        depth += 1
    return descendants


def search(query: str, max_results: int = 30) -> dict:
    svc = _drive_service()
    if not svc:
        return {"configured": False, "files": [], "error": "Drive not configured"}
    folder = _folder_id()
    if not folder:
        return {"configured": False, "files": [], "error": "GOOGLE_DRIVE_FOLDER_ID not set"}
    if not query or len(query.strip()) < 2:
        return {"configured": True, "files": [], "error": "Query too short"}
    q = _escape(query.strip())
    try:
        descendants = _bfs_descendants(folder, svc)
        # chunk by 25 parents per query (URL length safety)
        ids = list(descendants)
        all_hits: dict[str, dict] = {}
        for i in range(0, len(ids), 25):
            chunk = ids[i:i + 25]
            parent_clause = " or ".join(f"'{fid}' in parents" for fid in chunk)
            full_q = (
                f"(name contains '{q}' or fullText contains '{q}') "
                f"and mimeType != 'application/vnd.google-apps.folder' "
                f"and trashed = false and ({parent_clause})"
            )
            resp = svc.files().list(
                q=full_q,
                fields="files(id,name,mimeType,webViewLink,modifiedTime,size,parents)",
                orderBy="modifiedTime desc",
                pageSize=100,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            ).execute()
            for f in resp.get("files", []):
                fid = f.get("id")
                if fid and fid not in all_hits:
                    all_hits[fid] = f
            if len(all_hits) >= max_results * 3:
                break
        files = sorted(
            all_hits.values(),
            key=lambda x: x.get("modifiedTime") or "",
            reverse=True,
        )[:max_results]
        return {"configured": True, "files": files, "count": len(files)}
    except Exception as e:
        logger.error("Drive search error: %s", e)
        return {"configured": True, "files": [], "error": str(e)}


def get_file_meta(file_id: str) -> Optional[dict]:
    svc = _drive_service()
    if not svc:
        return None
    try:
        return svc.files().get(
            fileId=file_id,
            fields="id,name,mimeType,webViewLink,modifiedTime,size,parents",
            supportsAllDrives=True,
        ).execute()
    except Exception as e:
        logger.error("Drive get_file_meta: %s", e)
        return None
