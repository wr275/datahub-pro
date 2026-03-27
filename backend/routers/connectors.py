from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, DataFile, Connector
from auth_utils import get_current_user
import uuid, json, csv, io, re
from datetime import datetime
from typing import Optional

router = APIRouter()
SHOPIFY_API_VERSION = "2024-01"

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_shopify_resource(shop: str, token: str, resource: str) -> list:
    try:
        import httpx
    except ImportError:
        raise HTTPException(500, "httpx not installed. Add httpx to requirements.txt.")
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}
    url = f"https://{shop}/admin/api/{SHOPIFY_API_VERSION}/{resource}.json"
    params = {"limit": 250, "status": "any"} if resource == "orders" else {"limit": 250}
    all_items = []
    while url:
        resp = httpx.get(url, headers=headers, params=params, timeout=30)
        if resp.status_code in (401, 403):
            raise HTTPException(400, "Invalid Shopify credentials. Check your shop domain and access token.")
        if resp.status_code == 404:
            raise HTTPException(400, f"Shop not found: {shop}. Ensure the domain ends with .myshopify.com")
        if resp.status_code != 200:
            raise HTTPException(400, f"Shopify API error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        all_items.extend(data.get(resource, []))
        link = resp.headers.get("Link", "")
        m = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = m.group(1) if m else None
        params = {}
    return all_items

def flatten_orders(orders):
    cols = ["order_id","order_number","created_at","financial_status","fulfillment_status",
            "total_price","subtotal_price","total_tax","total_discounts","currency",
            "customer_email","customer_name","items_count","shipping_city","shipping_country"]
    rows = []
    for o in orders:
        cust = o.get("customer") or {}
        addr = o.get("shipping_address") or {}
        rows.append([
            o.get("id",""), o.get("order_number",""), o.get("created_at",""),
            o.get("financial_status",""), o.get("fulfillment_status","") or "unfulfilled",
            o.get("total_price",""), o.get("subtotal_price",""),
            o.get("total_tax",""), o.get("total_discounts",""), o.get("currency",""),
            cust.get("email",""),
            (cust.get("first_name","") + " " + cust.get("last_name","")).strip(),
            len(o.get("line_items",[])),
            addr.get("city",""), addr.get("country","")
        ])
    return cols, rows

def flatten_products(products):
    cols = ["product_id","title","vendor","product_type","status","created_at",
            "tags","variants_count","price","sku","inventory_quantity"]
    rows = []
    for p in products:
        v = (p.get("variants") or [{}])[0]
        rows.append([
            p.get("id",""), p.get("title",""), p.get("vendor",""),
            p.get("product_type",""), p.get("status",""), p.get("created_at",""),
            p.get("tags",""), len(p.get("variants",[])),
            v.get("price",""), v.get("sku",""), v.get("inventory_quantity","")
        ])
    return cols, rows

def flatten_customers(customers):
    cols = ["customer_id","email","first_name","last_name","phone","created_at",
            "orders_count","total_spent","city","country"]
    rows = []
    for c in customers:
        addr = (c.get("addresses") or [{}])[0]
        rows.append([
            c.get("id",""), c.get("email",""), c.get("first_name",""),
            c.get("last_name",""), c.get("phone",""), c.get("created_at",""),
            c.get("orders_count",""), c.get("total_spent",""),
            addr.get("city",""), addr.get("country","")
        ])
    return cols, rows

FLATTENERS = {"orders": flatten_orders, "products": flatten_products, "customers": flatten_customers}

def to_csv_bytes(cols, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    w.writerows(rows)
    return buf.getvalue().encode("utf-8")

# ── Schemas ───────────────────────────────────────────────────────────────────

class ShopifyConnectRequest(BaseModel):
    shop_domain: str
    access_token: str
    data_type: str = "orders"
    display_name: str = ""

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_connectors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conns = db.query(Connector).filter(
        Connector.organisation_id == current_user.organisation_id
    ).order_by(Connector.created_at.desc()).all()
    return [
        {
            "id": c.id, "name": c.name, "connector_type": c.connector_type,
            "data_type": (json.loads(c.config_json).get("data_type") if c.config_json else None),
            "status": c.status,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "last_file_id": c.last_file_id,
            "created_at": c.created_at.isoformat()
        }
        for c in conns
    ]

@router.post("/shopify/connect")
async def connect_shopify(
    body: ShopifyConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = body.shop_domain.strip().rstrip("/")
    if "." not in shop:
        shop = shop + ".myshopify.com"
    if not shop.endswith(".myshopify.com"):
        shop = shop.split(".")[0] + ".myshopify.com"
    if body.data_type not in FLATTENERS:
        raise HTTPException(400, f"data_type must be one of: {list(FLATTENERS.keys())}")
    items = fetch_shopify_resource(shop, body.access_token, body.data_type)
    cols, rows = FLATTENERS[body.data_type](items)
    content = to_csv_bytes(cols, rows)
    org = current_user.organisation
    if not org:
        raise HTTPException(403, "No organisation found")
    display = body.display_name.strip() or f"Shopify {body.data_type.title()}"
    file_id = str(uuid.uuid4())
    db_file = DataFile(
        id=file_id,
        filename=f"shopify_{body.data_type}_{file_id[:8]}.csv",
        original_filename=display + ".csv",
        file_size=len(content), row_count=len(rows), column_count=len(cols),
        columns_json=json.dumps(cols), storage_type="shopify",
        file_content=content, organisation_id=org.id, uploaded_by=current_user.id,
        source_url=f"shopify://{shop}/{body.data_type}",
        last_synced_at=datetime.utcnow()
    )
    db.add(db_file)
    conn_id = str(uuid.uuid4())
    conn = Connector(
        id=conn_id, name=display, connector_type="shopify",
        config_json=json.dumps({"shop_domain": shop, "access_token": body.access_token, "data_type": body.data_type}),
        status="active", last_sync_at=datetime.utcnow(), last_file_id=file_id,
        organisation_id=org.id, created_by=current_user.id
    )
    db.add(conn)
    db.commit()
    return {
        "id": conn_id, "name": display, "connector_type": "shopify",
        "data_type": body.data_type, "status": "active",
        "rows": len(rows), "columns": len(cols), "last_file_id": file_id,
        "last_sync_at": conn.last_sync_at.isoformat(),
        "message": f"Connected! Fetched {len(rows):,} {body.data_type}."
    }

@router.post("/shopify/sync/{connector_id}")
async def sync_shopify(
    connector_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conn = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.organisation_id == current_user.organisation_id
    ).first()
    if not conn:
        raise HTTPException(404, "Connector not found")
    config = json.loads(conn.config_json)
    items = fetch_shopify_resource(config["shop_domain"], config["access_token"], config["data_type"])
    cols, rows = FLATTENERS[config["data_type"]](items)
    content = to_csv_bytes(cols, rows)
    db_file = db.query(DataFile).filter(DataFile.id == conn.last_file_id).first() if conn.last_file_id else None
    if db_file:
        db_file.file_content = content
        db_file.file_size = len(content)
        db_file.row_count = len(rows)
        db_file.column_count = len(cols)
        db_file.columns_json = json.dumps(cols)
        db_file.last_synced_at = datetime.utcnow()
    else:
        file_id = str(uuid.uuid4())
        db_file = DataFile(
            id=file_id, filename=f"shopify_{config['data_type']}_{file_id[:8]}.csv",
            original_filename=conn.name + ".csv",
            file_size=len(content), row_count=len(rows), column_count=len(cols),
            columns_json=json.dumps(cols), storage_type="shopify", file_content=content,
            organisation_id=current_user.organisation_id, uploaded_by=current_user.id,
            source_url=f"shopify://{config['shop_domain']}/{config['data_type']}",
            last_synced_at=datetime.utcnow()
        )
        db.add(db_file)
        conn.last_file_id = file_id
    conn.last_sync_at = datetime.utcnow()
    conn.status = "active"
    db.commit()
    return {
        "id": connector_id, "rows": len(rows), "columns": len(cols),
        "last_sync_at": conn.last_sync_at.isoformat(),
        "message": f"Synced! {len(rows):,} {config['data_type']} updated."
    }

@router.delete("/{connector_id}")
def delete_connector(
    connector_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conn = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.organisation_id == current_user.organisation_id
    ).first()
    if not conn:
        raise HTTPException(404, "Connector not found")
    db.delete(conn)
    db.commit()
    return {"message": "Connector deleted"}
