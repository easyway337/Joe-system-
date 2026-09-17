from fastapi import APIRouter, HTTPException

from models.schemas import (
    InventoryItemCreate, InventoryItemUpdate, OrderCreate, OrderStatusUpdate,
    PurchaseOrderCreate, PurchaseOrderStatusUpdate,
)
from services import db_queries

router = APIRouter()


# =====================================================================
# Inventory
# =====================================================================

@router.get("/inventory")
async def list_inventory(low_stock_only: bool = False):
    return await db_queries.get_inventory(low_stock_only=low_stock_only)


@router.get("/inventory/search")
async def search_inventory(name: str):
    """Used by the AI widget's 'Check Inventory Status' quick command."""
    item = await db_queries.get_inventory_item_by_name(name)
    return item or {"found": False}


@router.post("/inventory", status_code=201)
async def create_inventory_item(item: InventoryItemCreate):
    return await db_queries.create_inventory_item(**item.model_dump())


@router.patch("/inventory/{item_id}")
async def update_inventory_item(item_id: str, item: InventoryItemUpdate):
    updated = await db_queries.update_inventory_item(item_id, **item.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return updated


# =====================================================================
# Orders
# =====================================================================

@router.get("/orders")
async def list_orders(status: str | None = None):
    return await db_queries.get_orders(status=status)


@router.post("/orders", status_code=201)
async def create_order(order: OrderCreate):
    if not order.items:
        raise HTTPException(status_code=400, detail="Order must include at least one item")
    return await db_queries.create_order(order.customer_name, [i.model_dump() for i in order.items])


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate):
    updated = await db_queries.update_order_status(order_id, payload.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
    return updated


# =====================================================================
# Procurement (purchase orders)
# =====================================================================

@router.get("/procurement")
async def list_purchase_orders(status: str | None = None):
    return await db_queries.get_purchase_orders(status=status)


@router.post("/procurement", status_code=201)
async def create_purchase_order(po: PurchaseOrderCreate):
    if not po.items:
        raise HTTPException(status_code=400, detail="Purchase order must include at least one item")
    return await db_queries.create_purchase_order(
        po.supplier_name, po.expected_date, [i.model_dump() for i in po.items]
    )


@router.patch("/procurement/{po_id}/status")
async def update_purchase_order_status(po_id: str, payload: PurchaseOrderStatusUpdate):
    """Setting status to 'received' automatically restocks inventory for every line item."""
    updated = await db_queries.update_purchase_order_status(po_id, payload.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return updated


# =====================================================================
# Reports
# =====================================================================

@router.get("/reports/stock-valuation")
async def stock_valuation():
    items = await db_queries.get_inventory()
    total = sum(i["quantity"] * i["unit_price"] for i in items)
    return {"items": items, "total_stock_value": round(total, 2)}


@router.get("/reports/low-stock")
async def low_stock_report():
    """Items at or below their reorder level — candidates for a new purchase order."""
    return await db_queries.get_inventory(low_stock_only=True)
