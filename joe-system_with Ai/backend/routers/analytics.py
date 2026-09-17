from fastapi import APIRouter

from services import db_queries

router = APIRouter()


@router.get("/kpis")
async def kpis():
    """KPI summary cards: Total Revenue, New Orders, Stock Value."""
    return await db_queries.get_kpi_summary()


@router.get("/sales-monthly")
async def sales_monthly():
    """Data for the Monthly Sales & Forecast bar chart."""
    return await db_queries.get_monthly_sales()


@router.get("/inventory-turnover")
async def inventory_turnover():
    """Data for the Inventory Turnover line chart."""
    return {"values": await db_queries.get_inventory_turnover()}


@router.get("/opportunities")
async def opportunities(limit: int = 10):
    """Active Opportunities table rows."""
    return await db_queries.get_opportunities(limit=limit)
