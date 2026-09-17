"""
db_queries.py
--------------
Data-access layer. Both CRM (Step 4) and ERP (Step 5) data now live in
Supabase/PostgreSQL — see sql/schema.sql and sql/erp_schema.sql for the
table definitions.

supabase-py is a synchronous client, so every Supabase call is wrapped in
`asyncio.to_thread(...)` to keep FastAPI's event loop non-blocking.
"""
import asyncio
import uuid
from datetime import datetime
from typing import Optional

from services.supabase_client import get_supabase


async def _run(fn, *args, **kwargs):
    """Run a blocking supabase-py call in a worker thread."""
    return await asyncio.to_thread(fn, *args, **kwargs)


def _new_number(prefix: str) -> str:
    """Short, readable order/PO numbers, e.g. ORD-4F21A9."""
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


# =====================================================================
# CRM — Accounts
# =====================================================================

async def get_accounts() -> list[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("accounts").select("*").order("created_at", desc=True).execute())
    return res.data


async def create_account(name: str, industry: str = "", owner: str = "", website: str = "") -> dict:
    sb = get_supabase()
    payload = {"name": name, "industry": industry, "owner": owner, "website": website}
    res = await _run(lambda: sb.table("accounts").insert(payload).execute())
    return res.data[0] if res.data else payload


# =====================================================================
# CRM — Leads
# =====================================================================

async def get_leads(status: Optional[str] = None) -> list[dict]:
    sb = get_supabase()

    def _query():
        q = sb.table("leads").select("*").order("created_at", desc=True)
        if status:
            q = q.eq("status", status)
        return q.execute()

    res = await _run(_query)
    return res.data


async def create_lead(name: str, company: str = "", email: str = "", phone: str = "", source: str = "manual") -> dict:
    sb = get_supabase()
    payload = {"name": name, "company": company, "email": email, "phone": phone, "source": source}
    res = await _run(lambda: sb.table("leads").insert(payload).execute())
    return res.data[0] if res.data else payload


async def update_lead_status(lead_id: str, status: str) -> Optional[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("leads").update({"status": status}).eq("id", lead_id).execute())
    return res.data[0] if res.data else None


async def get_top_leads(limit: int = 5) -> list[dict]:
    """Ranks the highest-value open deals — what "top leads" means in the UI/voice widget."""
    return await get_opportunities(limit=limit)


# =====================================================================
# CRM — Deals / Pipeline
# =====================================================================

async def get_opportunities(limit: int = 20) -> list[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("deals").select("*").order("value", desc=True).limit(limit).execute())
    return res.data


async def create_deal(client_name: str, deal_stage: str = "Qualified", value: float = 0,
                       probability: int = 0, owner: str = "", account_id: Optional[str] = None) -> dict:
    sb = get_supabase()
    payload = {
        "client_name": client_name, "deal_stage": deal_stage, "value": value,
        "probability": probability, "owner": owner, "account_id": account_id,
    }
    res = await _run(lambda: sb.table("deals").insert(payload).execute())
    return res.data[0] if res.data else payload


async def update_deal_stage(deal_id: str, deal_stage: str) -> Optional[dict]:
    sb = get_supabase()
    res = await _run(
        lambda: sb.table("deals")
        .update({"deal_stage": deal_stage, "last_activity": datetime.utcnow().isoformat()})
        .eq("id", deal_id).execute()
    )
    return res.data[0] if res.data else None


async def search_crm(query: str) -> dict:
    """ILIKE search across leads and accounts by name/company — used by the
    AI voice widget's "find account ..." command and the topbar search."""
    sb = get_supabase()
    pattern = f"%{query}%"
    leads_res = await _run(
        lambda: sb.table("leads").select("*").or_(f"name.ilike.{pattern},company.ilike.{pattern}").limit(5).execute()
    )
    accounts_res = await _run(lambda: sb.table("accounts").select("*").ilike("name", pattern).limit(5).execute())
    return {"leads": leads_res.data, "accounts": accounts_res.data}


# =====================================================================
# ERP — Inventory
# =====================================================================

async def get_inventory(low_stock_only: bool = False) -> list[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("inventory_items").select("*").order("name").execute())
    items = res.data
    if low_stock_only:
        items = [i for i in items if i["quantity"] <= i["reorder_level"]]
    return items


async def get_inventory_item(item_id: str) -> Optional[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("inventory_items").select("*").eq("id", item_id).limit(1).execute())
    return res.data[0] if res.data else None


async def get_inventory_item_by_name(name_fragment: str) -> Optional[dict]:
    """Used by the AI widget's "Check Inventory Status" voice command."""
    if not name_fragment:
        return None
    sb = get_supabase()
    res = await _run(
        lambda: sb.table("inventory_items").select("*").ilike("name", f"%{name_fragment}%").limit(1).execute()
    )
    return res.data[0] if res.data else None


async def create_inventory_item(sku: str, name: str, category: str = "", quantity: int = 0,
                                 reorder_level: int = 0, unit_price: float = 0, warehouse: str = "Main") -> dict:
    sb = get_supabase()
    payload = {
        "sku": sku, "name": name, "category": category, "quantity": quantity,
        "reorder_level": reorder_level, "unit_price": unit_price, "warehouse": warehouse,
    }
    res = await _run(lambda: sb.table("inventory_items").insert(payload).execute())
    return res.data[0] if res.data else payload


async def update_inventory_item(item_id: str, **fields) -> Optional[dict]:
    """Partial update — only non-None fields (from InventoryItemUpdate) are sent."""
    updates = {k: v for k, v in fields.items() if v is not None}
    if not updates:
        return await get_inventory_item(item_id)
    sb = get_supabase()
    res = await _run(lambda: sb.table("inventory_items").update(updates).eq("id", item_id).execute())
    return res.data[0] if res.data else None


async def adjust_inventory_quantity(item_id: str, delta: int) -> Optional[dict]:
    """Increase (delta > 0) or decrease (delta < 0) stock for one item.
    Used internally when orders are fulfilled or purchase orders are received."""
    item = await get_inventory_item(item_id)
    if not item:
        return None
    new_quantity = max(0, item["quantity"] + delta)
    return await update_inventory_item(item_id, quantity=new_quantity)


# =====================================================================
# ERP — Orders
# =====================================================================

async def get_orders(status: Optional[str] = None) -> list[dict]:
    sb = get_supabase()

    def _query():
        q = sb.table("orders").select("*, order_items(*)").order("created_at", desc=True)
        if status:
            q = q.eq("status", status)
        return q.execute()

    res = await _run(_query)
    return res.data


async def create_order(customer_name: str, items: list[dict]) -> dict:
    """items: [{"inventory_item_id", "item_name", "quantity", "unit_price"}, ...]
    (this is exactly what OrderLineItem.model_dump() produces in routers/erp.py).
    Fulfills the order out of stock (decrements inventory) and stores the total."""
    sb = get_supabase()
    total_value = sum(i["quantity"] * i["unit_price"] for i in items)

    order_payload = {
        "order_number": _new_number("ORD"),
        "customer_name": customer_name,
        "status": "pending",
        "total_value": round(total_value, 2),
    }
    order_res = await _run(lambda: sb.table("orders").insert(order_payload).execute())
    order = order_res.data[0]

    line_items = [{**i, "order_id": order["id"]} for i in items]
    if line_items:
        li_res = await _run(lambda: sb.table("order_items").insert(line_items).execute())
        order["order_items"] = li_res.data
        # Fulfilling the order pulls stock out of inventory.
        for line in items:
            if line.get("inventory_item_id"):
                await adjust_inventory_quantity(line["inventory_item_id"], -line["quantity"])

    return order


async def update_order_status(order_id: str, status: str) -> Optional[dict]:
    sb = get_supabase()
    res = await _run(lambda: sb.table("orders").update({"status": status}).eq("id", order_id).execute())
    return res.data[0] if res.data else None


# =====================================================================
# ERP — Procurement / Purchase Orders
# =====================================================================

async def get_purchase_orders(status: Optional[str] = None) -> list[dict]:
    sb = get_supabase()

    def _query():
        q = sb.table("purchase_orders").select("*, purchase_order_items(*)").order("created_at", desc=True)
        if status:
            q = q.eq("status", status)
        return q.execute()

    res = await _run(_query)
    return res.data


async def create_purchase_order(supplier_name: str, expected_date: Optional[str], items: list[dict]) -> dict:
    """items: [{"inventory_item_id", "item_name", "quantity", "unit_cost"}, ...]"""
    sb = get_supabase()
    total_value = sum(i["quantity"] * i["unit_cost"] for i in items)

    po_payload = {
        "po_number": _new_number("PO"),
        "supplier_name": supplier_name,
        "status": "draft",
        "total_value": round(total_value, 2),
        "expected_date": expected_date,
    }
    po_res = await _run(lambda: sb.table("purchase_orders").insert(po_payload).execute())
    po = po_res.data[0]

    line_items = [{**i, "purchase_order_id": po["id"]} for i in items]
    if line_items:
        li_res = await _run(lambda: sb.table("purchase_order_items").insert(line_items).execute())
        po["purchase_order_items"] = li_res.data

    return po


async def update_purchase_order_status(po_id: str, status: str) -> Optional[dict]:
    """Marking a PO as 'received' automatically restocks inventory for every line item."""
    sb = get_supabase()
    res = await _run(lambda: sb.table("purchase_orders").update({"status": status}).eq("id", po_id).execute())
    updated = res.data[0] if res.data else None
    if not updated:
        return None

    if status == "received":
        items_res = await _run(
            lambda: sb.table("purchase_order_items").select("*").eq("purchase_order_id", po_id).execute()
        )
        for line in items_res.data:
            if line.get("inventory_item_id"):
                await adjust_inventory_quantity(line["inventory_item_id"], line["quantity"])

    return updated


# =====================================================================
# Analytics — dashboard KPIs / charts
# =====================================================================

async def get_kpi_summary() -> dict:
    items = await get_inventory()
    stock_value = sum(i["quantity"] * float(i["unit_price"]) for i in items)
    deals = await get_opportunities(limit=100)
    total_revenue = sum(d["value"] for d in deals) if deals else 0
    orders = await get_orders()
    return {
        "total_revenue": total_revenue,
        "new_orders": len(orders),
        "stock_value": round(stock_value, 2),
    }


# Monthly sales & inventory turnover charts stay as illustrative mock
# series for now — wiring these to real historical order data is a good
# follow-up once there's more than a few days of order history to chart.
_MOCK_SALES_MONTHLY = [
    ("Jan", 120), ("Feb", 150), ("Mar", 170), ("Apr", 140), ("May", 190), ("Jun", 210),
    ("Jul", 205), ("Aug", 230), ("Sep", 521), ("Oct", 240), ("Nov", 260), ("Dec", 280),
]
_MOCK_INVENTORY_TURNOVER = [12, 18, 15, 22, 19, 28, 24, 30, 27, 33, 29, 36]


async def get_monthly_sales() -> list[dict]:
    return [{"month": m, "value": v} for m, v in _MOCK_SALES_MONTHLY]


async def get_inventory_turnover() -> list[int]:
    return _MOCK_INVENTORY_TURNOVER
