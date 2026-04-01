"""
SharePoint / OneDrive Integration Router
────────────────────────────────────────
Implements the full Microsoft OAuth2 flow with optional tenant scoping:
  1. GET  /auth-url        → returns MS login URL (tenant-scoped if tenant provided)
  2. GET  /callback        → exchanges code for tokens, stores them, redirects to frontend
  3. GET  /status          → is the current org connected?
  4. DELETE /disconnect    → revoke & delete stored tokens
  5. GET  /drives          → list accessible OneDrive + SharePoint drives
  6. GET  /files           → list files/folders inside a drive or folder
  7. POST /import          → download a file from SP/OD and import it into DataHub Pro

Tenant scoping:
  - Pass ?tenant=contoso.com (domain) or ?tenant=<uuid> (tenant ID) to /auth-url
  - Without tenant → uses /common/ endpoint (personal + any org accounts)
  - With tenant    → uses /{tenant}/ endpoint (locks to that org's Azure AD)
  - Tenant is stored with the token and used for all subsequent refreshes

Required env vars (set in Railway service):
  MICROSOFT_CLIENT_ID       – Azure AD app client ID
  MICROSOFT_CLIENT_SECRET   – Azure AD app client secret
  MICROSOFT_REDIRECT_URI    – e.g. https://<backend>.up.railway.app/api/sharepoint/callback
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, User, DataFile
from auth_utils import get_current_user
from config import settings
import httpx
import uuid
import json
from datetime import datetime, timedelta

# ── N02: Fernet encryption for stored SharePoint tokens ───────────────────────
from cryptography.fernet import Fernet

def _get_fernet():
    key = getattr(settings, "FERNET_KEY", None)
    if not key:
        return None
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return None

def _encrypt_sp_token(value: str) -> str:
    """Encrypt a token string; returns as-is if Fernet not configured."""
    if not value:
        return value
    f = _get_fernet()
    if f is None:
        return value
    return "enc:" + f.encrypt(value.encode()).decode()

def _decrypt_sp_token(value: str) -> str:
    """Decrypt a token string; returns as-is if not encrypted or Fernet unavailable."""
    if not value or not value.startswith("enc:"):
        return value
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value[4:].encode()).decode()
    except Exception:
        return value



router = APIRouter()

GRAPH_BASE  = "https://graph.microsoft.com/v1.0"
SCOPES      = "Files.Read Sites.Read.All offline_access User.Read"
ALLOWED_EXT = {".xlsx", ".xls", ".csv"}


def _oauth_base(tenant: str | None = None) -> str:
    """Return the correct Microsoft OAuth base URL for the given tenant.
    Falls back to /common/ if no tenant specified (personal + any org)."""
    scope = tenant if tenant else "common"
    return f"https://login.microsoftonline.com/{scope}/oauth2/v2.0"


# ── Token persistence helpers ─────────────────────────────────────────────────

def _get_org_token(db: Session, org_id: str):
    return db.execute(
        text(
            "SELECT access_token, refresh_token, expires_at, tenant_id "
            "FROM sharepoint_tokens WHERE organisation_id = :oid"
        ),
        {"oid": org_id},
    ).fetchone()


def _save_org_token(
    db: Session, org_id: str, access_token: str,
    refresh_token: str, expires_in: int, tenant_id: str | None = None
):
    expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
    db.execute(
        text("""
            INSERT INTO sharepoint_tokens
                (id, organisation_id, access_token, refresh_token, expires_at, tenant_id, created_at)
            VALUES (:id, :oid, :at, :rt, :ea, :tid, NOW())
            ON CONFLICT (organisation_id) DO UPDATE
               SET access_token  = EXCLUDED.access_token,
                   refresh_token = EXCLUDED.refresh_token,
                   expires_at    = EXCLUDED.expires_at,
                   tenant_id     = EXCLUDED.tenant_id
        """),
        {
            "id":  str(uuid.uuid4()),
            "oid": org_id,
            "at":  _encrypt_sp_token(access_token),
            "rt":  _encrypt_sp_token(refresh_token),
            "ea":  expires_at,
            "tid": tenant_id,
        },
    )
    db.commit()


async def _get_valid_access_token(db: Session, org_id: str) -> str:
    """Return a fresh access token, refreshing via refresh_token if needed."""
    row = _get_org_token(db, org_id)
    if not row:
        raise HTTPException(
            status_code=401,
            detail="SharePoint not connected. Connect via Integrations → SharePoint.",
        )
    access_token, refresh_token, expires_at_str, tenant_id = row
    access_token = _decrypt_sp_token(access_token)
    refresh_token = _decrypt_sp_token(refresh_token)
    expires_at = datetime.fromisoformat(expires_at_str)

    if datetime.utcnow() > expires_at - timedelta(minutes=5):
        # Use the stored tenant for refresh so we stay scoped to the right org
        oauth_base = _oauth_base(tenant_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{oauth_base}/token",
                data={
                    "client_id":     settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "grant_type":    "refresh_token",
                    "refresh_token": refresh_token,
                    "scope":         SCOPES,
                },
            )
        if resp.status_code != 200:
            db.execute(
                text("DELETE FROM sharepoint_tokens WHERE organisation_id = :oid"),
                {"oid": org_id},
            )
            db.commit()
            raise HTTPException(
                status_code=401,
                detail="SharePoint session expired. Please reconnect.",
            )
        data = resp.json()
        new_refresh = data.get("refresh_token", refresh_token)
        _save_org_token(db, org_id, data["access_token"], new_refresh, data["expires_in"], tenant_id)
        return data["access_token"]

    return access_token


# ── OAuth initiation ──────────────────────────────────────────────────────────

@router.get("/auth-url")
async def get_auth_url(
    tenant: str = Query(None, description="Azure AD tenant domain (e.g. contoso.com) or tenant UUID. Omit for personal/any-org accounts."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the Microsoft OAuth URL. Frontend opens this to start the flow.
    Pass ?tenant=contoso.com to lock auth to a specific organisation's Azure AD.
    """
    if not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="SharePoint integration is not configured on this server.",
        )

    # Normalise tenant — strip whitespace and leading https:// if someone pastes a URL
    clean_tenant = None
    if tenant:
        clean_tenant = tenant.strip().lower()
        clean_tenant = clean_tenant.replace("https://", "").replace("http://", "").rstrip("/")
        # If they pasted a full login URL, extract just the tenant part
        if "login.microsoftonline.com" in clean_tenant:
            clean_tenant = None  # ignore, treat as common

    # Store a short-lived state so the callback can identify the org + tenant
    state = str(uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    db.execute(
        text("""
            INSERT INTO oauth_states (state, organisation_id, tenant_id, created_at, expires_at)
            VALUES (:state, :oid, :tid, NOW(), :ea)
        """),
        {"state": state, "oid": current_user.organisation_id, "tid": clean_tenant, "ea": expires_at},
    )
    db.commit()

    oauth_base    = _oauth_base(clean_tenant)
    scope_encoded = SCOPES.replace(" ", "%20")
    redirect_uri  = settings.MICROSOFT_REDIRECT_URI

    url = (
        f"{oauth_base}/authorize"
        f"?client_id={settings.MICROSOFT_CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope_encoded}"
        f"&state={state}"
        f"&prompt=select_account"
    )
    return {"url": url, "tenant": clean_tenant}


# ── OAuth callback (called by Microsoft after login) ─────────────────────────

@router.get("/callback")
async def oauth_callback(
    code: str  = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Exchange auth code for tokens, store them, redirect to frontend."""
    row = db.execute(
        text("SELECT organisation_id, tenant_id, expires_at FROM oauth_states WHERE state = :state"),
        {"state": state},
    ).fetchone()

    frontend_origin = settings.FRONTEND_URL.split(",")[0].strip()

    if not row:
        return RedirectResponse(url=f"{frontend_origin}/sharepoint?error=invalid_state")

    org_id, tenant_id, expires_at_str = row
    if datetime.utcnow() > datetime.fromisoformat(expires_at_str):
        return RedirectResponse(url=f"{frontend_origin}/sharepoint?error=state_expired")

    # Consume the state (one-time use)
    db.execute(text("DELETE FROM oauth_states WHERE state = :state"), {"state": state})
    db.commit()

    # Use the same tenant endpoint that was used to initiate auth
    oauth_base = _oauth_base(tenant_id)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{oauth_base}/token",
            data={
                "client_id":     settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "code":          code,
                "grant_type":    "authorization_code",
                "redirect_uri":  settings.MICROSOFT_REDIRECT_URI,
                "scope":         SCOPES,
            },
        )

    if resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_origin}/sharepoint?error=token_failed")

    data = resp.json()
    _save_org_token(
        db, org_id,
        data["access_token"],
        data.get("refresh_token", ""),
        data["expires_in"],
        tenant_id,   # ← stored for scoped refreshes
    )

    # Pass tenant back to frontend so it can display it
    tenant_param = f"&tenant={tenant_id}" if tenant_id else ""
    return RedirectResponse(url=f"{frontend_origin}/sharepoint?connected=true{tenant_param}")


# ── Connection status ─────────────────────────────────────────────────────────

@router.get("/status")
async def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_org_token(db, current_user.organisation_id)
    if not row:
        return {"connected": False}

    _, _, _, tenant_id = row

    try:
        token = await _get_valid_access_token(db, current_user.organisation_id)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GRAPH_BASE}/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
        if resp.status_code == 200:
            profile = resp.json()
            return {
                "connected":    True,
                "display_name": profile.get("displayName"),
                "email":        profile.get("mail") or profile.get("userPrincipalName"),
                "tenant":       tenant_id,
            }
    except HTTPException:
        pass

    return {"connected": True, "display_name": None, "email": None, "tenant": tenant_id}


@router.delete("/disconnect")
async def disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text("DELETE FROM sharepoint_tokens WHERE organisation_id = :oid"),
        {"oid": current_user.organisation_id},
    )
    db.commit()
    return {"message": "SharePoint disconnected successfully"}


# ── File browser ──────────────────────────────────────────────────────────────

@router.get("/drives")
async def list_drives(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all OneDrive and SharePoint drives accessible to the connected account."""
    token   = await _get_valid_access_token(db, current_user.organisation_id)
    headers = {"Authorization": f"Bearer {token}"}
    drives  = []

    async with httpx.AsyncClient() as client:
        # Personal OneDrive
        r = await client.get(f"{GRAPH_BASE}/me/drives", headers=headers, timeout=15)
        if r.status_code == 200:
            for d in r.json().get("value", []):
                drives.append({
                    "id":         d["id"],
                    "name":       d.get("name", "My OneDrive"),
                    "type":       "onedrive",
                    "drive_type": d.get("driveType", "personal"),
                })

        # SharePoint sites the user follows
        r = await client.get(f"{GRAPH_BASE}/me/followedSites", headers=headers, timeout=15)
        if r.status_code == 200:
            for site in r.json().get("value", []):
                site_id = site["id"]
                dr = await client.get(
                    f"{GRAPH_BASE}/sites/{site_id}/drives", headers=headers, timeout=10
                )
                if dr.status_code == 200:
                    for d in dr.json().get("value", []):
                        drives.append({
                            "id":         d["id"],
                            "name":       f"{site.get('displayName', 'SharePoint')} — {d.get('name', 'Documents')}",
                            "type":       "sharepoint",
                            "drive_type": d.get("driveType", "documentLibrary"),
                        })

        # Root SharePoint site drives
        r = await client.get(f"{GRAPH_BASE}/sites/root/drives", headers=headers, timeout=10)
        if r.status_code == 200:
            for d in r.json().get("value", []):
                drives.append({
                    "id":         d["id"],
                    "name":       f"Root Site — {d.get('name', 'Documents')}",
                    "type":       "sharepoint",
                    "drive_type": d.get("driveType", "documentLibrary"),
                })

    # Deduplicate
    seen, unique = set(), []
    for d in drives:
        if d["id"] not in seen:
            seen.add(d["id"])
            unique.append(d)

    return {"drives": unique}


@router.get("/files")
async def list_files(
    drive_id:  str = Query(...),
    folder_id: str = Query(None, description="Item ID of the folder; omit for root"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List files and sub-folders inside a drive or folder."""
    token   = await _get_valid_access_token(db, current_user.organisation_id)
    headers = {"Authorization": f"Bearer {token}"}

    url = (
        f"{GRAPH_BASE}/drives/{drive_id}/items/{folder_id}/children"
        if folder_id else
        f"{GRAPH_BASE}/drives/{drive_id}/root/children"
    )

    async with httpx.AsyncClient() as client:
        r = await client.get(
            url, headers=headers,
            params={"$select": "id,name,size,file,folder,lastModifiedDateTime,webUrl"},
            timeout=15,
        )

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Failed to list files from SharePoint")

    items = []
    for item in r.json().get("value", []):
        is_file    = "file" in item
        name       = item["name"]
        ext        = ("." + name.rsplit(".", 1)[-1].lower()) if is_file and "." in name else ""
        importable = ext in ALLOWED_EXT

        items.append({
            "id":         item["id"],
            "name":       name,
            "type":       "file" if is_file else "folder",
            "size":       item.get("size", 0),
            "modified":   item.get("lastModifiedDateTime"),
            "web_url":    item.get("webUrl"),
            "importable": importable,
            "extension":  ext,
        })

    items.sort(key=lambda x: (0 if x["type"] == "folder" else 1, x["name"].lower()))
    return {"items": items}


# ── Import a file ─────────────────────────────────────────────────────────────

@router.post("/import")
async def import_file(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a file from SharePoint/OneDrive and import it into DataHub Pro."""
    drive_id = body.get("drive_id")
    item_id  = body.get("item_id")
    filename = body.get("filename", "imported.xlsx")

    if not drive_id or not item_id:
        raise HTTPException(status_code=400, detail="drive_id and item_id are required")

    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files can be imported.")

    token = await _get_valid_access_token(db, current_user.organisation_id)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(
            f"{GRAPH_BASE}/drives/{drive_id}/items/{item_id}/content",
            headers={"Authorization": f"Bearer {token}"},
            timeout=120,
        )

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Failed to download file from SharePoint")

    file_bytes = r.content
    file_size  = len(file_bytes)

    if settings.STORAGE_TYPE == "s3" and settings.AWS_BUCKET_NAME:
        from routers.files import save_file_r2
        storage_key     = save_file_r2(file_bytes, filename)
        storage_type    = "s3"
        file_content_db = None
    else:
        from routers.files import save_file_local
        storage_key     = save_file_local(file_bytes, filename)
        storage_type    = "local"
        file_content_db = file_bytes

    row_count, column_count, columns_json = 0, 0, "[]"
    try:
        import io
        if ext in (".xlsx", ".xls"):
            import openpyxl
            wb  = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
            ws  = wb.active
            hdr = next(ws.iter_rows(max_row=1, values_only=True), None)
            if hdr:
                headers      = [str(c) if c is not None else f"Col{i}" for i, c in enumerate(hdr)]
                column_count = len(headers)
                columns_json = json.dumps(headers)
            row_count = max(0, (ws.max_row or 1) - 1)
        elif ext == ".csv":
            import csv
            reader       = csv.reader(io.StringIO(file_bytes.decode("utf-8", errors="replace")))
            rows         = list(reader)
            column_count = len(rows[0]) if rows else 0
            columns_json = json.dumps(rows[0]) if rows else "[]"
            row_count    = max(0, len(rows) - 1)
    except Exception:
        pass

    file_id = str(uuid.uuid4())
    db_file = DataFile(
        id=file_id,
        filename=storage_key,
        original_filename=filename,
        file_size=file_size,
        row_count=row_count,
        column_count=column_count,
        columns_json=columns_json,
        s3_key=storage_key if storage_type == "s3" else None,
        storage_type=storage_type,
        file_content=file_content_db,
        organisation_id=current_user.organisation_id,
        uploaded_by=current_user.id,
    )
    db.add(db_file)
    db.commit()

    return {
        "id":           file_id,
        "filename":     filename,
        "file_size":    file_size,
        "row_count":    row_count,
        "column_count": column_count,
        "message":      f"'{filename}' imported successfully from SharePoint",
    }
