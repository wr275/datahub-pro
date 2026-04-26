"""
Google Sheets Integration Router
────────────────────────────────
Supports two modes:

  1. PUBLIC SHEETS (legacy — no OAuth needed)
     The simple "Anyone with the link can view" flow. Uses the docs.google.com
     CSV export URL. Kept for users who can't or won't do OAuth.
       POST /connect           — connect a public sheet by URL
       POST /{file_id}/sync    — manual re-fetch

  2. OAUTH (Google Sheets 2.0 — private sheets + scheduled sync)
     Full OAuth2 Authorization Code flow. Once connected, the caller can
     browse their own Drive, pick any sheet (private or shared), and toggle
     automatic scheduled sync on each connected sheet.
       GET    /oauth/auth-url      — returns Google OAuth URL
       GET    /oauth/callback      — exchange code → tokens → redirect
       GET    /oauth/status        — is this org connected?
       DELETE /oauth/disconnect    — revoke tokens
       GET    /oauth/list-sheets   — browse the user's Drive for spreadsheets
       POST   /oauth/connect-sheet — import a specific sheet by spreadsheet_id

Sync schedules:
       POST   /{file_id}/sync-schedule   — set frequency (hourly/daily/off)
       GET    /{file_id}/sync-schedule   — read current schedule

Required env vars (set in Railway → backend service):
  GOOGLE_CLIENT_ID        — from Google Cloud Console OAuth 2.0 Client ID
  GOOGLE_CLIENT_SECRET    — from Google Cloud Console OAuth 2.0 Client Secret
  GOOGLE_REDIRECT_URI     — e.g. https://<backend>.up.railway.app/api/sheets/oauth/callback
                            (must EXACTLY match the URI registered in GCP)

Google Cloud setup checklist (user-side):
  1. https://console.cloud.google.com → create a project (or reuse).
  2. APIs & Services → Library → enable "Google Sheets API" AND "Google Drive API".
  3. APIs & Services → OAuth consent screen → External, add `waqas114@gmail.com`
     as a test user until the app is verified.
  4. APIs & Services → Credentials → Create OAuth client ID (Web application).
     Add `GOOGLE_REDIRECT_URI` under "Authorized redirect URIs".
  5. Copy the Client ID + Client Secret into Railway env vars.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import uuid
import re
import json
import io
import csv
import httpx

from database import get_db, User, DataFile
from auth_utils import get_current_user
from config import settings

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────────

GOOGLE_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO   = "https://www.googleapis.com/oauth2/v3/userinfo"
SHEETS_API_BASE   = "https://sheets.googleapis.com/v4/spreadsheets"
DRIVE_API_BASE    = "https://www.googleapis.com/drive/v3"

# Read-only: we never write back. `offline_access` is implied by `access_type=offline`.
OAUTH_SCOPES = " ".join([
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "openid",
    "email",
])

VALID_SYNC_FREQUENCIES = {"off", "hourly", "daily"}


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY — public-sheet helpers (unchanged behaviour, kept for backward compat)
# ══════════════════════════════════════════════════════════════════════════════

def extract_sheet_id(url: str) -> Optional[str]:
    """Extract the spreadsheet ID from any Google Sheets URL format."""
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9\-_]+)', url)
    return match.group(1) if match else None


def extract_gid(url: str) -> Optional[str]:
    """Extract the tab gid from URL if present (e.g. #gid=123456789)."""
    match = re.search(r'[#&?]gid=(\d+)', url)
    return match.group(1) if match else None


def build_export_url(sheet_id: str, gid: Optional[str] = None) -> str:
    base = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid and gid != "0":
        base += f"&gid={gid}"
    return base


def fetch_public_sheet_as_csv(sheet_id: str, gid: Optional[str] = None) -> bytes:
    """Fetch a publicly shared Google Sheet as CSV bytes."""
    export_url = build_export_url(sheet_id, gid)
    try:
        resp = httpx.get(export_url, follow_redirects=True, timeout=30)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Google Sheets: {str(e)}")

    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=400,
            detail='Sheet is not publicly accessible. Share it with "Anyone with the link can view" or connect via OAuth.'
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch sheet (Google returned {resp.status_code}). Try OAuth for private sheets."
        )
    if "text/html" in resp.headers.get("content-type", ""):
        raise HTTPException(
            status_code=400,
            detail='Sheet is not publicly accessible. Share it publicly or connect via OAuth.'
        )
    return resp.content


def parse_csv_bytes(content: bytes) -> tuple[list[str], int, int]:
    """Parse CSV bytes → (columns, row_count, col_count)."""
    text_val = content.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text_val))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="The sheet appears to be empty.")
    columns = [str(h).strip() for h in rows[0] if str(h).strip()]
    if not columns:
        raise HTTPException(status_code=400, detail="Could not read column headers from the sheet.")
    return columns, len(rows) - 1, len(columns)


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — token persistence helpers
# ══════════════════════════════════════════════════════════════════════════════

def _get_org_token(db: Session, org_id: str):
    return db.execute(
        text(
            "SELECT access_token, refresh_token, expires_at, email "
            "FROM google_tokens WHERE organisation_id = :oid"
        ),
        {"oid": org_id},
    ).fetchone()


def _save_org_token(
    db: Session, org_id: str, access_token: str,
    refresh_token: str, expires_in: int, email: Optional[str] = None,
):
    expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
    db.execute(
        text("""
            INSERT INTO google_tokens
                (id, organisation_id, access_token, refresh_token, expires_at, email, created_at)
            VALUES (:id, :oid, :at, :rt, :ea, :em, NOW())
            ON CONFLICT (organisation_id) DO UPDATE
               SET access_token  = EXCLUDED.access_token,
                   refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
                   expires_at    = EXCLUDED.expires_at,
                   email         = COALESCE(EXCLUDED.email, google_tokens.email)
        """),
        {
            "id":  str(uuid.uuid4()),
            "oid": org_id,
            "at":  access_token,
            "rt":  refresh_token or None,
            "ea":  expires_at,
            "em":  email,
        },
    )
    db.commit()


async def _refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id":     settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type":    "refresh_token",
            },
            timeout=15,
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Google session expired. Please reconnect in Integrations → Google Sheets.",
        )
    return resp.json()


async def _get_valid_access_token(db: Session, org_id: str) -> str:
    """Return a fresh access token, refreshing via refresh_token if needed."""
    row = _get_org_token(db, org_id)
    if not row:
        raise HTTPException(
            status_code=401,
            detail="Google Sheets not connected. Connect via Integrations → Google Sheets.",
        )
    access_token, refresh_token, expires_at_str, _email = row
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
    except Exception:
        expires_at = datetime.utcnow() - timedelta(minutes=1)

    if datetime.utcnow() > expires_at - timedelta(minutes=5):
        if not refresh_token:
            raise HTTPException(status_code=401, detail="Google session expired. Please reconnect.")
        data = await _refresh_access_token(refresh_token)
        new_refresh = data.get("refresh_token") or refresh_token
        _save_org_token(db, org_id, data["access_token"], new_refresh, data["expires_in"])
        return data["access_token"]

    return access_token


def _require_oauth_config():
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        raise HTTPException(
            status_code=501,
            detail="Google Sheets OAuth is not configured on this server. "
                   "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.",
        )


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — data fetching via Sheets API
# ══════════════════════════════════════════════════════════════════════════════

async def _fetch_spreadsheet_meta(access_token: str, spreadsheet_id: str) -> dict:
    """Get sheet metadata (title, tabs)."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SHEETS_API_BASE}/{spreadsheet_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"fields": "properties.title,sheets(properties(sheetId,title,index))"},
            timeout=15,
        )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Spreadsheet not found or access denied.")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Failed to fetch spreadsheet metadata.")
    return r.json()


async def _fetch_tab_values(access_token: str, spreadsheet_id: str, tab_title: str) -> list[list]:
    """Read all values from a single tab via values.get."""
    # URL-encode the tab title — sheets allow spaces / quotes which must be escaped
    rng = tab_title.replace("'", "''")
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SHEETS_API_BASE}/{spreadsheet_id}/values/'{rng}'",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"majorDimension": "ROWS", "valueRenderOption": "FORMATTED_VALUE"},
            timeout=30,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=f"Failed to read tab '{tab_title}'.")
    return r.json().get("values", [])


def _values_to_csv_bytes(values: list[list]) -> bytes:
    """Normalise a 2D array of cell values into canonical CSV bytes."""
    if not values:
        return b""
    # Pad rows to the widest header so csv stays rectangular
    width = max(len(r) for r in values)
    out = io.StringIO()
    w = csv.writer(out)
    for row in values:
        padded = list(row) + [""] * (width - len(row))
        w.writerow(["" if v is None else str(v) for v in padded])
    return out.getvalue().encode("utf-8")


async def _fetch_sheet_via_oauth(access_token: str, spreadsheet_id: str, tab_title: Optional[str] = None):
    """Return (csv_bytes, columns, row_count, col_count, tab_used)."""
    meta = await _fetch_spreadsheet_meta(access_token, spreadsheet_id)
    tabs = [s["properties"] for s in meta.get("sheets", [])]
    if not tabs:
        raise HTTPException(status_code=400, detail="Spreadsheet has no tabs.")

    # Pick the requested tab, else the first one
    chosen = None
    if tab_title:
        chosen = next((t for t in tabs if t.get("title") == tab_title), None)
        if not chosen:
            raise HTTPException(status_code=400, detail=f"Tab '{tab_title}' not found.")
    else:
        chosen = sorted(tabs, key=lambda t: t.get("index", 0))[0]

    values = await _fetch_tab_values(access_token, spreadsheet_id, chosen["title"])
    content = _values_to_csv_bytes(values)
    if not values:
        raise HTTPException(status_code=400, detail="That tab is empty.")
    columns = [str(h).strip() for h in values[0] if str(h).strip()]
    if not columns:
        raise HTTPException(status_code=400, detail="Could not read column headers from the tab.")
    row_count = len(values) - 1
    col_count = len(columns)
    return content, columns, row_count, col_count, chosen["title"]


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ConnectSheetRequest(BaseModel):
    url: str
    display_name: str = ""


class ConnectPrivateSheetRequest(BaseModel):
    spreadsheet_id: str = Field(..., description="Drive file ID of the sheet")
    tab_title: Optional[str] = Field(None, description="Tab name; defaults to first tab")
    display_name: Optional[str] = Field(None, description="Human-readable name shown in Files")


class SyncScheduleRequest(BaseModel):
    frequency: str = Field(..., description="off, hourly, or daily")


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY PUBLIC-SHEET ENDPOINTS (unchanged)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/connect")
async def connect_public_sheet(
    body: ConnectSheetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Connect a publicly shared Google Sheet as a DataFile (no OAuth)."""
    sheet_id = extract_sheet_id(body.url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL.")

    gid = extract_gid(body.url)
    content = fetch_public_sheet_as_csv(sheet_id, gid)
    columns, row_count, col_count = parse_csv_bytes(content)

    display_name = (body.display_name or "").strip() or f"Google Sheet ({sheet_id[:8]})"
    if not display_name.endswith(".csv"):
        display_name += ".csv"

    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=403, detail="No organisation found")

    file_id = str(uuid.uuid4())
    db_file = DataFile(
        id=file_id,
        filename=f"sheets_{sheet_id[:16]}_{file_id[:8]}.csv",
        original_filename=display_name,
        file_size=len(content),
        row_count=row_count,
        column_count=col_count,
        columns_json=json.dumps(columns),
        s3_key=None,
        storage_type="google_sheets",
        file_content=content,
        organisation_id=org.id,
        uploaded_by=current_user.id,
        source_url=body.url.strip(),
        last_synced_at=datetime.utcnow(),
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": display_name,
        "size": len(content),
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "source_type": "google_sheets",
        "mode": "public",
        "source_url": body.url.strip(),
        "last_synced_at": db_file.last_synced_at.isoformat(),
        "uploaded_at": db_file.created_at.isoformat(),
    }


@router.post("/{file_id}/sync")
async def sync_sheet(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-fetch the latest data from a connected sheet (works for both modes)."""
    db_file = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if db_file.storage_type != "google_sheets":
        raise HTTPException(status_code=400, detail="This file is not a connected Google Sheet")

    # Distinguish by the stored source_url:
    #   public sheets → https://docs.google.com/spreadsheets/d/...
    #   oauth sheets  → google-sheets://<spreadsheet_id>?tab=<tab_title>
    src = db_file.source_url or ""

    if src.startswith("google-sheets://"):
        access_token = await _get_valid_access_token(db, current_user.organisation_id)
        spreadsheet_id = src.replace("google-sheets://", "").split("?", 1)[0]
        tab_title = None
        if "?tab=" in src:
            tab_title = src.split("?tab=", 1)[1]
        content, columns, row_count, col_count, _tab = await _fetch_sheet_via_oauth(
            access_token, spreadsheet_id, tab_title
        )
    else:
        sheet_id = extract_sheet_id(src)
        gid = extract_gid(src)
        if not sheet_id:
            raise HTTPException(status_code=400, detail="No source URL stored for this sheet")
        content = fetch_public_sheet_as_csv(sheet_id, gid)
        columns, row_count, col_count = parse_csv_bytes(content)

    db_file.file_content = content
    db_file.file_size = len(content)
    db_file.row_count = row_count
    db_file.column_count = col_count
    db_file.columns_json = json.dumps(columns)
    db_file.last_synced_at = datetime.utcnow()
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": db_file.original_filename,
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "last_synced_at": db_file.last_synced_at.isoformat(),
        "message": f"Synced — {row_count:,} rows, {col_count} columns",
    }


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — INITIATION + CALLBACK
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/oauth/auth-url")
async def get_auth_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the Google OAuth URL. Frontend opens it to start the flow."""
    _require_oauth_config()

    state = str(uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    db.execute(
        text("""
            INSERT INTO google_oauth_states (state, organisation_id, user_id, created_at, expires_at)
            VALUES (:state, :oid, :uid, NOW(), :ea)
        """),
        {"state": state, "oid": current_user.organisation_id, "uid": current_user.id, "ea": expires_at},
    )
    db.commit()

    from urllib.parse import urlencode
    params = {
        "client_id":     settings.GOOGLE_CLIENT_ID,
        "redirect_uri":  settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope":         OAUTH_SCOPES,
        "access_type":   "offline",
        "prompt":        "consent",  # force refresh_token every time
        "state":         state,
        "include_granted_scopes": "true",
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/oauth/callback")
async def oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Exchange auth code for tokens, store them, redirect to frontend."""
    frontend_origin = settings.FRONTEND_URL.split(",")[0].strip()

    if error:
        return RedirectResponse(url=f"{frontend_origin}/google-sheets?error={error}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend_origin}/google-sheets?error=missing_code")

    row = db.execute(
        text("SELECT organisation_id, expires_at FROM google_oauth_states WHERE state = :s"),
        {"s": state},
    ).fetchone()
    if not row:
        return RedirectResponse(url=f"{frontend_origin}/google-sheets?error=invalid_state")
    org_id, expires_at_str = row
    if datetime.utcnow() > datetime.fromisoformat(expires_at_str):
        return RedirectResponse(url=f"{frontend_origin}/google-sheets?error=state_expired")

    db.execute(text("DELETE FROM google_oauth_states WHERE state = :s"), {"s": state})
    db.commit()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code":          code,
                "client_id":     settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri":  settings.GOOGLE_REDIRECT_URI,
                "grant_type":    "authorization_code",
            },
            timeout=20,
        )
    if resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_origin}/google-sheets?error=token_failed")

    data = resp.json()
    # Fetch user profile to display who's connected
    email = None
    try:
        async with httpx.AsyncClient() as client:
            ur = await client.get(
                GOOGLE_USERINFO,
                headers={"Authorization": f"Bearer {data['access_token']}"},
                timeout=10,
            )
        if ur.status_code == 200:
            email = ur.json().get("email")
    except Exception:
        pass

    _save_org_token(
        db, org_id,
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", ""),
        expires_in=data.get("expires_in", 3600),
        email=email,
    )
    return RedirectResponse(url=f"{frontend_origin}/google-sheets?connected=true")


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — STATUS + DISCONNECT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/oauth/status")
async def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    configured = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    row = _get_org_token(db, current_user.organisation_id)
    if not row:
        return {"connected": False, "configured": configured, "email": None}
    _, _, _, email = row
    return {"connected": True, "configured": configured, "email": email}


@router.delete("/oauth/disconnect")
async def disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_org_token(db, current_user.organisation_id)
    if row and row[1]:  # refresh_token
        try:
            async with httpx.AsyncClient() as client:
                await client.post(GOOGLE_REVOKE_URL, params={"token": row[1]}, timeout=10)
        except Exception:
            pass  # Revoke failure shouldn't block disconnect
    db.execute(
        text("DELETE FROM google_tokens WHERE organisation_id = :oid"),
        {"oid": current_user.organisation_id},
    )
    # Also disable any active sync schedules — the files stay, but won't auto-refresh
    db.execute(
        text("""UPDATE data_files SET sync_frequency = 'off'
                WHERE organisation_id = :oid AND storage_type = 'google_sheets'"""),
        {"oid": current_user.organisation_id},
    )
    db.commit()
    return {"message": "Google Sheets disconnected"}


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — DRIVE BROWSER
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/oauth/list-sheets")
async def list_sheets(
    query: str = Query("", description="Optional filter on sheet name"),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Google Sheets visible to the connected Drive account."""
    token = await _get_valid_access_token(db, current_user.organisation_id)

    # Only list actual spreadsheet MIME types, most-recent first
    q_parts = [
        "mimeType='application/vnd.google-apps.spreadsheet'",
        "trashed=false",
    ]
    clean_query = (query or "").strip().replace("'", "\\'")
    if clean_query:
        q_parts.append(f"name contains '{clean_query}'")

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{DRIVE_API_BASE}/files",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "q": " and ".join(q_parts),
                "pageSize": page_size,
                "orderBy": "modifiedTime desc",
                "fields": "files(id,name,modifiedTime,owners(displayName,emailAddress),webViewLink)",
            },
            timeout=20,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Failed to list sheets from Drive.")

    items = []
    for f in r.json().get("files", []):
        owner = ""
        owners = f.get("owners") or []
        if owners:
            owner = owners[0].get("displayName") or owners[0].get("emailAddress") or ""
        items.append({
            "id":        f["id"],
            "name":      f["name"],
            "modified":  f.get("modifiedTime"),
            "owner":     owner,
            "web_link":  f.get("webViewLink"),
        })
    return {"items": items}


@router.get("/oauth/sheet-tabs")
async def sheet_tabs(
    spreadsheet_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the tabs in a spreadsheet so the user can pick one."""
    token = await _get_valid_access_token(db, current_user.organisation_id)
    meta = await _fetch_spreadsheet_meta(token, spreadsheet_id)
    return {
        "title": meta.get("properties", {}).get("title"),
        "tabs": [
            {
                "id":    s["properties"]["sheetId"],
                "title": s["properties"]["title"],
                "index": s["properties"].get("index", 0),
            }
            for s in meta.get("sheets", [])
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH — IMPORT + SYNC SCHEDULE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/oauth/connect-sheet")
async def connect_private_sheet(
    body: ConnectPrivateSheetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import a Drive spreadsheet into DataHub as a DataFile (OAuth-backed)."""
    token = await _get_valid_access_token(db, current_user.organisation_id)
    content, columns, row_count, col_count, tab_used = await _fetch_sheet_via_oauth(
        token, body.spreadsheet_id, body.tab_title,
    )

    meta = await _fetch_spreadsheet_meta(token, body.spreadsheet_id)
    title = meta.get("properties", {}).get("title") or f"Sheet {body.spreadsheet_id[:8]}"
    display_name = (body.display_name or "").strip() or f"{title} — {tab_used}"
    if not display_name.endswith(".csv"):
        display_name += ".csv"

    org = current_user.organisation
    if not org:
        raise HTTPException(status_code=403, detail="No organisation found")

    # Store source_url as a pseudo-URI so /sync can distinguish the OAuth path
    source_uri = f"google-sheets://{body.spreadsheet_id}?tab={tab_used}"

    file_id = str(uuid.uuid4())
    db_file = DataFile(
        id=file_id,
        filename=f"sheets_oauth_{body.spreadsheet_id[:16]}_{file_id[:8]}.csv",
        original_filename=display_name,
        file_size=len(content),
        row_count=row_count,
        column_count=col_count,
        columns_json=json.dumps(columns),
        s3_key=None,
        storage_type="google_sheets",
        file_content=content,
        organisation_id=org.id,
        uploaded_by=current_user.id,
        source_url=source_uri,
        last_synced_at=datetime.utcnow(),
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {
        "id": file_id,
        "filename": display_name,
        "size": len(content),
        "rows": row_count,
        "columns": col_count,
        "column_names": columns,
        "source_type": "google_sheets",
        "mode": "oauth",
        "spreadsheet_id": body.spreadsheet_id,
        "tab": tab_used,
        "last_synced_at": db_file.last_synced_at.isoformat(),
        "uploaded_at": db_file.created_at.isoformat(),
    }


@router.get("/{file_id}/sync-schedule")
async def get_sync_schedule(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    freq = getattr(db_file, "sync_frequency", None) or "off"
    return {
        "file_id": file_id,
        "frequency": freq,
        "last_synced_at": db_file.last_synced_at.isoformat() if db_file.last_synced_at else None,
        "last_sync_error": getattr(db_file, "last_sync_error", None),
    }


@router.post("/{file_id}/sync-schedule")
async def set_sync_schedule(
    file_id: str,
    body: SyncScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    freq = (body.frequency or "off").lower().strip()
    if freq not in VALID_SYNC_FREQUENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"frequency must be one of: {', '.join(sorted(VALID_SYNC_FREQUENCIES))}",
        )

    db_file = db.query(DataFile).filter(
        DataFile.id == file_id,
        DataFile.organisation_id == current_user.organisation_id,
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if db_file.storage_type != "google_sheets":
        raise HTTPException(status_code=400, detail="Only Google Sheets support auto-sync.")

    # Only oauth-mode sheets can actually auto-sync (public sheets lack creds
    # but can use `sync-schedule=off` to turn off anything stale).
    src = db_file.source_url or ""
    if freq != "off" and not src.startswith("google-sheets://"):
        raise HTTPException(
            status_code=400,
            detail="Auto-sync requires OAuth-connected sheets. Reconnect via Integrations → Google Sheets.",
        )

    db_file.sync_frequency = freq
    db.commit()
    db.refresh(db_file)

    # Re-register the APScheduler job for this file
    try:
        import scheduler as app_scheduler
        app_scheduler.register_sheet_sync_job(db_file)
    except Exception:
        pass

    return {
        "file_id": file_id,
        "frequency": freq,
        "message": "Auto-sync disabled." if freq == "off" else f"Auto-sync set to {freq}.",
    }


@router.get("/scheduled-syncs")
async def list_scheduled_syncs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List every Google Sheet in the org with a non-off sync frequency."""
    rows = db.query(DataFile).filter(
        DataFile.organisation_id == current_user.organisation_id,
        DataFile.storage_type == "google_sheets",
    ).all()
    return {
        "items": [
            {
                "file_id": r.id,
                "filename": r.original_filename,
                "frequency": getattr(r, "sync_frequency", "off") or "off",
                "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None,
                "last_sync_error": getattr(r, "last_sync_error", None),
                "mode": "oauth" if (r.source_url or "").startswith("google-sheets://") else "public",
            }
            for r in rows
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# SCHEDULER CALLBACK — invoked by APScheduler
# ══════════════════════════════════════════════════════════════════════════════

def execute_sheet_sync(file_id: str) -> None:
    """Sync a Google Sheet; called by APScheduler. Catches its own errors."""
    from database import SessionLocal
    import asyncio
    import logging
    logger = logging.getLogger(__name__)

    db = SessionLocal()
    try:
        db_file = db.query(DataFile).filter(DataFile.id == file_id).first()
        if not db_file or db_file.storage_type != "google_sheets":
            return
        if getattr(db_file, "sync_frequency", "off") == "off":
            return

        src = db_file.source_url or ""
        try:
            if src.startswith("google-sheets://"):
                # Need the org's access token
                async def _go():
                    token = await _get_valid_access_token(db, db_file.organisation_id)
                    spreadsheet_id = src.replace("google-sheets://", "").split("?", 1)[0]
                    tab_title = src.split("?tab=", 1)[1] if "?tab=" in src else None
                    return await _fetch_sheet_via_oauth(token, spreadsheet_id, tab_title)
                content, columns, row_count, col_count, _tab = asyncio.run(_go())
            else:
                sheet_id = extract_sheet_id(src)
                gid = extract_gid(src)
                if not sheet_id:
                    raise RuntimeError("No source URL stored")
                content = fetch_public_sheet_as_csv(sheet_id, gid)
                columns, row_count, col_count = parse_csv_bytes(content)

            db_file.file_content = content
            db_file.file_size = len(content)
            db_file.row_count = row_count
            db_file.column_count = col_count
            db_file.columns_json = json.dumps(columns)
            db_file.last_synced_at = datetime.utcnow()
            db_file.last_sync_error = None
            db.commit()
            logger.info("Synced sheet %s (%s rows)", file_id, row_count)
        except Exception as exc:
            db.rollback()
            db_file.last_sync_error = str(exc)[:500]
            db.commit()
            logger.warning("Sheet sync failed for %s: %s", file_id, exc)
    finally:
        db.close()
