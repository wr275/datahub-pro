"""
Connectors — Shopify (orders / products / customers).

Security:
  - Access tokens are Fernet-encrypted via crypto_utils before being stored
    in Connector.config_json. Decryption happens only inside fetch_shopify_*.
  - Legacy plaintext tokens are detected and transparently re-encrypted on
    the first successful sync.

Incremental sync:
  - connect_shopify does an initial FULL pull and writes a snapshot file.
  - sync_shopify reuses the connector's last_sync_at as updated_at_min, pulls
    only records modified since, merges them with the previous snapshot by
    record ID, and writes a fresh snapshot file. First sync after connect is
    therefore tiny (no new rows) and fast; big historical backfills stay out
    of the repeat-sync path.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Tuple
import asyncio
import uuid
import csv
import io
import json
import re
from datetime import datetime, timezone

from database import get_db, Connector, DataFile
from routers.auth import get_current_user
from crypto_utils import encrypt_secret, decrypt_secret, looks_encrypted

router = APIRouter()


class ShopifyConnectRequest(BaseModel):
    name: str
    shop_domain: str
    access_token: str
    resource: str = "orders"  # orders, products, customers


# -----------------------------------------------------------------------------
# Shopify API client
# -----------------------------------------------------------------------------

async def fetch_shopify_resource(
    shop_domain: str,
    access_token: str,
    resource: str,
    updated_at_min: Optional[str] = None,
    max_pages: int = 40,
) -> List[Dict[str, Any]]:
    """Page through Shopify, optionally filtered to records updated since
    `updated_at_min` (ISO-8601 string). Retries once on 429 with Retry-After."""
    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=500, detail="httpx not installed. Add httpx to requirements.txt")

    base_url = f"https://{shop_domain}/admin/api/2024-01/{resource}.json"
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    params: Dict[str, Any] = {"limit": 250}
    if updated_at_min:
        # orders/products/customers all accept updated_at_min
        params["updated_at_min"] = updated_at_min

    all_records: List[Dict[str, Any]] = []
    pages = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            pages += 1
            resp = await client.get(base_url, headers=headers, params=params)

            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", "2"))
                await asyncio.sleep(min(retry_after, 10.0))
                resp = await client.get(base_url, headers=headers, params=params)

            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Shopify rejected the access token (401 Unauthorized)")
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Shopify resource not found: {resource} on {shop_domain}")
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Shopify API error {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()
            records = data.get(resource, [])
            all_records.extend(records)

            if pages >= max_pages:
                break

            # Pagination via Link header (page_info cursor)
            link = resp.headers.get("Link", "")
            m = re.search(r'<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"', link)
            if not m:
                break
            # When paginating via page_info, only `limit` and `page_info` may be passed
            params = {"limit": 250, "page_info": m.group(1)}

    return all_records


# -----------------------------------------------------------------------------
# Flatteners (same shape as before; unchanged for stability)
# -----------------------------------------------------------------------------

def flatten_orders(records: list) -> list:
    rows = []
    for o in records:
        rows.append({
            "id": o.get("id"),
            "order_number": o.get("order_number"),
            "created_at": o.get("created_at", "")[:10] if o.get("created_at") else "",
            "updated_at": o.get("updated_at", "")[:10] if o.get("updated_at") else "",
            "financial_status": o.get("financial_status"),
            "fulfillment_status": o.get("fulfillment_status"),
            "total_price": o.get("total_price"),
            "currency": o.get("currency"),
            "customer_email": (o.get("customer") or {}).get("email"),
            "customer_name": f"{(o.get('customer') or {}).get('first_name', '')} {(o.get('customer') or {}).get('last_name', '')}".strip(),
            "line_items_count": len(o.get("line_items", [])),
        })
    return rows


def flatten_products(records: list) -> list:
    rows = []
    for p in records:
        for v in p.get("variants", [p]):
            rows.append({
                # Composite ID so snapshot merging dedupes by product+variant
                "id": f"{p.get('id')}::{v.get('id')}",
                "product_id": p.get("id"),
                "title": p.get("title"),
                "vendor": p.get("vendor"),
                "product_type": p.get("product_type"),
                "status": p.get("status"),
                "variant_id": v.get("id"),
                "variant_title": v.get("title"),
                "sku": v.get("sku"),
                "price": v.get("price"),
                "inventory_quantity": v.get("inventory_quantity"),
                "created_at": p.get("created_at", "")[:10] if p.get("created_at") else "",
                "updated_at": p.get("updated_at", "")[:10] if p.get("updated_at") else "",
            })
    return rows


def flatten_customers(records: list) -> list:
    rows = []
    for c in records:
        rows.append({
            "id": c.get("id"),
            "email": c.get("email"),
            "first_name": c.get("first_name"),
            "last_name": c.get("last_name"),
            "orders_count": c.get("orders_count"),
            "total_spent": c.get("total_spent"),
            "currency": c.get("currency"),
            "created_at": c.get("created_at", "")[:10] if c.get("created_at") else "",
            "updated_at": c.get("updated_at", "")[:10] if c.get("updated_at") else "",
            "city": (c.get("default_address") or {}).get("city"),
            "country": (c.get("default_address") or {}).get("country"),
        })
    return rows


def flatten(resource: str, records: list) -> list:
    if resource == "orders":
        return flatten_orders(records)
    if resource == "products":
        return flatten_products(records)
    if resource == "customers":
        return flatten_customers(records)
    return records


# -----------------------------------------------------------------------------
# Snapshot merge — upsert new rows into the previous snapshot by `id`
# -----------------------------------------------------------------------------

def _load_snapshot_rows(db: Session, file_id: Optional[str]) -> List[Dict[str, Any]]:
    if not file_id:
        return []
    f = db.query(DataFile).filter(DataFile.id == file_id).first()
    if not f or not f.file_content:
        return []
    try:
        raw = bytes(f.file_content).decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(raw))
        return list(reader)
    except Exception:
        return []


def _merge_by_id(previous: List[Dict[str, Any]], new: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Upsert: records from `new` overwrite entries with matching `id` in
    `previous`; records with new IDs are appended. If an `id` field isn't
    present, `new` replaces `previous` wholesale."""
    if not previous:
        return new
    if not new:
        return previous
    if "id" not in new[0] or "id" not in previous[0]:
        return new
    by_id: Dict[str, Dict[str, Any]] = {str(r.get("id")): r for r in previous}
    for r in new:
        by_id[str(r.get("id"))] = r
    return list(by_id.values())


def to_csv_bytes(rows: list) -> bytes:
    if not rows:
        return b""
    # Union of all keys across rows — previous snapshots may carry slightly
    # different columns if we've added fields in a later schema revision.
    fieldnames: List[str] = []
    seen = set()
    for r in rows:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                fieldnames.append(k)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


# -----------------------------------------------------------------------------
# Token storage helpers — transparent encryption + legacy migration
# -----------------------------------------------------------------------------

def _stored_token_from_config(config: Dict[str, Any]) -> Tuple[str, bool]:
    """Return (plaintext_token, was_already_encrypted)."""
    enc = config.get("access_token_enc")
    if enc:
        return decrypt_secret(enc), True
    legacy = config.get("access_token", "")
    if legacy and looks_encrypted(legacy):
        return decrypt_secret(legacy), True
    return legacy or "", False


def _save_encrypted_token(config: Dict[str, Any], plaintext: str) -> Dict[str, Any]:
    """Strip legacy plaintext and stamp the encrypted token into config."""
    config = dict(config)
    config.pop("access_token", None)
    config["access_token_enc"] = encrypt_secret(plaintext)
    return config


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/")
def list_connectors(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    connectors = db.query(Connector).filter(
        Connector.organisation_id == current_user.organisation_id
    ).order_by(Connector.created_at.desc()).all()
    result = []
    for c in connectors:
        cfg = json.loads(c.config_json) if c.config_json else {}
        # Never surface the token (encrypted or plaintext) in the list response
        cfg.pop("access_token", None)
        cfg.pop("access_token_enc", None)
        result.append({
            "id": c.id,
            "name": c.name,
            "connector_type": c.connector_type,
            "status": c.status,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "last_file_id": c.last_file_id,
            "config": cfg,
        })
    return result


@router.post("/shopify/connect")
async def connect_shopify(
    req: ShopifyConnectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if req.resource not in ("orders", "products", "customers"):
        raise HTTPException(status_code=400, detail=f"Unsupported resource: {req.resource}")

    # Full initial pull — no updated_at_min filter
    records = await fetch_shopify_resource(req.shop_domain, req.access_token, req.resource)
    rows = flatten(req.resource, records)

    csv_bytes = to_csv_bytes(rows)
    columns = list(rows[0].keys()) if rows else []

    file_id = str(uuid.uuid4())
    filename = f"shopify_{req.resource}_{req.shop_domain.split('.')[0]}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    data_file = DataFile(
        id=file_id,
        filename=filename,
        original_filename=filename,
        file_size=len(csv_bytes),
        row_count=len(rows),
        column_count=len(columns),
        columns_json=json.dumps(columns),
        storage_type="shopify",
        file_content=csv_bytes,
        organisation_id=current_user.organisation_id,
        uploaded_by=current_user.id,
    )
    db.add(data_file)

    config = {
        "shop_domain": req.shop_domain,
        "resource": req.resource,
    }
    config = _save_encrypted_token(config, req.access_token)

    now = datetime.utcnow()
    connector = Connector(
        id=str(uuid.uuid4()),
        name=req.name,
        connector_type="shopify",
        config_json=json.dumps(config),
        status="active",
        last_sync_at=now,
        last_file_id=file_id,
        organisation_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    db.add(connector)
    db.commit()

    return {
        "connector_id": connector.id,
        "file_id": file_id,
        "rows_synced": len(rows),
        "message": f"Successfully synced {len(rows)} {req.resource} from Shopify",
    }


@router.post("/shopify/sync/{connector_id}")
async def sync_shopify(
    connector_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    connector = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.organisation_id == current_user.organisation_id
    ).first()
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    config = json.loads(connector.config_json or "{}")
    shop_domain = config.get("shop_domain")
    resource = config.get("resource", "orders")

    access_token, already_encrypted = _stored_token_from_config(config)
    if not shop_domain or not access_token:
        raise HTTPException(
            status_code=400,
            detail="Connector is missing credentials. Please re-connect the source."
        )

    # Incremental: pull records updated since last_sync_at (with a 1-minute
    # overlap to cover clock skew). Full sync if we have no prior snapshot.
    updated_at_min: Optional[str] = None
    if connector.last_sync_at and connector.last_file_id:
        overlap = connector.last_sync_at
        try:
            from datetime import timedelta
            overlap = connector.last_sync_at - timedelta(minutes=1)
        except Exception:
            pass
        updated_at_min = overlap.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") \
            if overlap.tzinfo is None else overlap.isoformat()

    new_records = await fetch_shopify_resource(
        shop_domain, access_token, resource, updated_at_min=updated_at_min,
    )
    new_rows = flatten(resource, new_records)

    # Merge with previous snapshot
    prev_rows = _load_snapshot_rows(db, connector.last_file_id) if updated_at_min else []
    merged = _merge_by_id(prev_rows, new_rows)

    csv_bytes = to_csv_bytes(merged)
    columns = list(merged[0].keys()) if merged else []

    file_id = str(uuid.uuid4())
    filename = f"shopify_{resource}_{shop_domain.split('.')[0]}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
    data_file = DataFile(
        id=file_id,
        filename=filename,
        original_filename=filename,
        file_size=len(csv_bytes),
        row_count=len(merged),
        column_count=len(columns),
        columns_json=json.dumps(columns),
        storage_type="shopify",
        file_content=csv_bytes,
        organisation_id=current_user.organisation_id,
        uploaded_by=current_user.id,
    )
    db.add(data_file)

    # Opportunistically re-encrypt a legacy plaintext token
    if not already_encrypted or "access_token" in config:
        config = _save_encrypted_token(config, access_token)
        connector.config_json = json.dumps(config)

    connector.last_sync_at = datetime.utcnow()
    connector.last_file_id = file_id
    db.commit()

    return {
        "file_id": file_id,
        "rows_synced": len(merged),
        "new_or_changed": len(new_rows),
        "incremental": bool(updated_at_min),
        "message": (
            f"Re-synced {len(merged)} {resource} "
            f"({len(new_rows)} new/changed since last sync)"
            if updated_at_min else
            f"Full re-sync: {len(merged)} {resource}"
        ),
    }


@router.delete("/{connector_id}")
def delete_connector(
    connector_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    connector = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.organisation_id == current_user.organisation_id
    ).first()
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    db.delete(connector)
    db.commit()
    return {"message": "Connector removed"}
