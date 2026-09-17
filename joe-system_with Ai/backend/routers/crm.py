from fastapi import APIRouter, HTTPException, Query

from models.schemas import AccountCreate, DealCreate, DealStageUpdate, LeadCreate, LeadStatusUpdate
from services import db_queries

router = APIRouter()


# =====================================================================
# Leads
# =====================================================================

@router.get("/leads")
async def list_leads(status: str | None = None):
    return await db_queries.get_leads(status=status)


@router.get("/leads/top")
async def top_leads(limit: int = 5):
    return await db_queries.get_top_leads(limit=limit)


@router.post("/leads", status_code=201)
async def create_lead(lead: LeadCreate):
    """Create a new lead. Wired for both the CRM UI form and the AI voice widget."""
    if not lead.name.strip():
        raise HTTPException(status_code=400, detail="Lead name is required")
    return await db_queries.create_lead(
        name=lead.name, company=lead.company or "", email=lead.email or "",
        phone=lead.phone or "", source=lead.source or "manual",
    )


@router.patch("/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, payload: LeadStatusUpdate):
    updated = await db_queries.update_lead_status(lead_id, payload.status.value)
    if not updated:
        raise HTTPException(status_code=404, detail="Lead not found")
    return updated


# =====================================================================
# Accounts
# =====================================================================

@router.get("/accounts")
async def list_accounts():
    return await db_queries.get_accounts()


@router.post("/accounts", status_code=201)
async def create_account(account: AccountCreate):
    if not account.name.strip():
        raise HTTPException(status_code=400, detail="Account name is required")
    return await db_queries.create_account(
        name=account.name, industry=account.industry or "",
        owner=account.owner or "", website=account.website or "",
    )


# =====================================================================
# Deals / Pipeline
# =====================================================================

@router.get("/deals")
async def list_deals(limit: int = 50):
    """Sales pipeline: all deals across stages, powers the Pipeline board."""
    return await db_queries.get_opportunities(limit=limit)


@router.get("/opportunities")
async def list_opportunities(limit: int = 20):
    """Kept for backwards compatibility with the dashboard's existing calls."""
    return await db_queries.get_opportunities(limit=limit)


@router.post("/deals", status_code=201)
async def create_deal(deal: DealCreate):
    if not deal.client_name.strip():
        raise HTTPException(status_code=400, detail="Client name is required")
    return await db_queries.create_deal(
        client_name=deal.client_name, deal_stage=deal.deal_stage.value,
        value=deal.value, probability=deal.probability,
        owner=deal.owner or "", account_id=deal.account_id,
    )


@router.patch("/deals/{deal_id}/stage")
async def update_deal_stage(deal_id: str, payload: DealStageUpdate):
    updated = await db_queries.update_deal_stage(deal_id, payload.deal_stage.value)
    if not updated:
        raise HTTPException(status_code=404, detail="Deal not found")
    return updated


# =====================================================================
# Search — used by the AI voice widget ("find account Apex") and the topbar
# =====================================================================

@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    return await db_queries.search_crm(q)
