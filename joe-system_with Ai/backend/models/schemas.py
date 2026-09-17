"""
Shared Pydantic models (DB-agnostic for now).
Swap these for SQLModel/SQLAlchemy models once a real database is wired in.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DealStage(str, Enum):
    QUALIFIED = "Qualified"
    PROPOSAL = "Proposal"
    NEGOTIATION = "Negotiation"
    WON = "Won"
    LOST = "Lost"


class Opportunity(BaseModel):
    id: int
    client_name: str
    deal_stage: DealStage
    value: float
    probability: int = Field(ge=0, le=100)
    owner: str
    last_activity: datetime


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class LeadCreate(BaseModel):
    """Payload for POST /api/crm/leads — used by both the CRM form and the AI widget."""
    name: str
    company: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    source: Optional[str] = "manual"


class LeadStatusUpdate(BaseModel):
    status: LeadStatus


class AccountCreate(BaseModel):
    name: str
    industry: Optional[str] = ""
    owner: Optional[str] = ""
    website: Optional[str] = ""


class DealCreate(BaseModel):
    client_name: str
    deal_stage: DealStage = DealStage.QUALIFIED
    value: float = 0
    probability: int = Field(default=0, ge=0, le=100)
    owner: Optional[str] = ""
    account_id: Optional[str] = None


class DealStageUpdate(BaseModel):
    deal_stage: DealStage


class InventoryItem(BaseModel):
    id: int
    sku: str
    name: str
    quantity: int
    reorder_level: int
    unit_price: float
    warehouse: str

    @property
    def stock_value(self) -> float:
        return self.quantity * self.unit_price


class InventoryItemCreate(BaseModel):
    sku: str
    name: str
    category: Optional[str] = ""
    quantity: int = 0
    reorder_level: int = 0
    unit_price: float = 0
    warehouse: str = "Main"


class InventoryItemUpdate(BaseModel):
    """All fields optional — PATCH only sends what changed."""
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    unit_price: Optional[float] = None
    warehouse: Optional[str] = None


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OrderLineItem(BaseModel):
    inventory_item_id: Optional[str] = None
    item_name: str
    quantity: int = Field(gt=0)
    unit_price: float = 0


class OrderCreate(BaseModel):
    customer_name: str
    items: list[OrderLineItem]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class PurchaseOrderStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class PurchaseOrderLineItem(BaseModel):
    inventory_item_id: Optional[str] = None
    item_name: str
    quantity: int = Field(gt=0)
    unit_cost: float = 0


class PurchaseOrderCreate(BaseModel):
    supplier_name: str
    expected_date: Optional[str] = None  # "YYYY-MM-DD"
    items: list[PurchaseOrderLineItem]


class PurchaseOrderStatusUpdate(BaseModel):
    status: PurchaseOrderStatus


class KPISummary(BaseModel):
    total_revenue: float
    new_orders: int
    stock_value: float


class VoiceCommandRequest(BaseModel):
    transcript: str


class VoiceCommandResponse(BaseModel):
    intent: str
    reply_text: str
    data: Optional[dict] = None
