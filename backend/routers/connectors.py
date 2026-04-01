from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import csv
import io
import json
from datetime import datetime

from database import get_db, Connector, DataFile
from auth_utils import get_current_user

router = APIRouter()


class ShopifyConnectRequest(BaseModel):
    name: str
    shop_domain: str
    access_token: str
    resource: str = "orders"  # orders, products, customers


async def fetch_shopify_resource(shop_domain: str, access_token: str, resource: str) -> list:
    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=500, detail="httpx not installed. Add httpx to requirements.txt")

    base_url = f"https://{shop_domain}/admin/api/2024-01/{resource}.json"
    headers = {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}
    all_records = []
    params = {"limit": 250}

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            resp = await client.get(base_url, headers=headers, params=params)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Shopify API error {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
            records = data.get(resource, [])
            all_records.extend(records)
            # Pagination via Link header
            link = resp.headers.get("Link", "")
            if 'rel="next"' in link:
                # extract next page_info
                import re
                match = re.search(r'page_info=([^&>]+).*?rel="next"', link)
                if match:
                    params = {"limit": 250, "page_info": match.group(1)}
                else:
                    break
            else:
                break

    return all_records


def flatten_orders(records: list) -> list:
    rows = []
    for o in records:
        rows.append({
            "id": o.get("id"),
            "order_number": o.get("order_number"),
            "created_at": o.get("created_at", "")[:10] if o.get("created_at") else "",
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
            "city": (c.get("default_address") or {}).get("city"),
            "country": (c.get("default_address") or {}).get("country"),
        })
    return rows


def to_csv_bytes(rows: list) -> bytes:
    if not rows:
        return b""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


@router.get("/")
def list_connectors(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    connectors = db.query(Connector).filter(
        Connector.organisation_id == current_user.organisation_id
    ).order_by(Connector.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "connector_type": c.connector_type,
            "status": c.status,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "last_file_id": c.last_file_id,
            "config": json.loads(c.config_json) if c.config_json else {},
        }
        for c in connectors
    ]


@router.post("/shopify/connect")
async def connect_shopify(
    req: ShopifyConnectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Fetch data from Shopify
    records = await fetch_shopify_resource(req.shop_domain, req.access_token, req.resource)

    if req.resource == "orders":
        rows = flatten_orders(records)
    elif req.resource == "products":
        rows = flatten_products(records)
    elif req.resource == "customers":
        rows = flatten_customers(records)
    else:
        rows = records

    csv_bytes = to_csv_bytes(rows)
    columns = list(rows[0].keys()) if rows else []

    # Save as DataFile
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

    # Save connector record
    config = {"shop_domain": req.shop_domain, "resource": req.resource}
    connector = Connector(
        id=str(uuid.uuid4()),
        name=req.name,
        connector_type="shopify",
        config_json=json.dumps(config),
        status="active",
        last_sync_at=datetime.utcnow(),
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
        "message": f"Successfully synced {len(rows)} {req.resource} from Shopify"
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
    access_token = config.get("access_token", "")

    if not shop_domain or not access_token:
        raise HTTPException(status_code=400, detail="Connector config missing shop_domain or access_token")

    records = await fetch_shopify_resource(shop_domain, access_token, resource)

    if resource == "orders":
        rows = flatten_orders(records)
    elif resource == "products":
        rows = flatten_products(records)
    elif resource == "customers":
        rows = flatten_customers(records)
    else:
        rows = records

    csv_bytes = to_csv_bytes(rows)
    columns = list(rows[0].keys()) if rows else []

    file_id = str(uuid.uuid4())
    filename = f"shopify_{resource}_{shop_domain.split('.')[0]}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.csv"
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

    connector.last_sync_at = datetime.utcnow()
    connector.last_file_id = file_id
    db.commit()

    return {"file_id": file_id, "rows_synced": len(rows), "message": f"Re-synced {len(rows)} {resource}"}


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
