"""
ai_parser.py
-------------
Turns a raw speech transcript (already converted to text by the browser's
Web Speech API) into an action + a spoken reply.

Two modes, chosen automatically:

1. LLM mode (if GROQ_API_KEY is set) — sends the transcript to a Groq-hosted
   model with a list of "tools" (one per supported action). The model picks
   the right tool and extracts the arguments (product name, lead name,
   quantities, ...) from free-form speech in either Arabic or English —
   no keyword list to maintain, and it understands phrasing variations the
   old keyword matcher would miss.
2. Keyword fallback (no API key, or the Groq call fails/times out) — the
   original simple keyword matcher from Step 3. This keeps the project
   runnable out of the box with zero configuration and zero API keys.

Either way, once the intent + arguments are known, a plain Python function
(the "executor") actually calls db_queries.py — the LLM never touches the
database directly, it only decides *what* to do.
"""
import json
import re
from dataclasses import dataclass
from typing import Optional

from services import db_queries
from services.groq_client import GROQ_MODEL, get_groq_client

# =====================================================================
# Tool definitions (OpenAI-compatible function-calling schema, which Groq
# also implements). Each one maps 1:1 to an "executor" function below.
# =====================================================================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_inventory",
            "description": "Look up how much stock is left for a product in the warehouse.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "Name or partial name of the product."},
                },
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_lead",
            "description": "Create a new sales lead in the CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Full name of the lead/contact."},
                    "company": {"type": "string", "description": "The lead's company, if mentioned."},
                    "email": {"type": "string", "description": "Email address, if mentioned."},
                    "phone": {"type": "string", "description": "Phone number, if mentioned."},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_leads",
            "description": "Get the highest-value open deals/opportunities (\"top leads\").",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue_summary",
            "description": "Get the total revenue, stock value, and order count KPIs.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_crm",
            "description": "Search for a lead or an account (company) by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Name (or part of a name) to search for."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_deal",
            "description": "Create a new deal/opportunity in the sales pipeline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {"type": "string"},
                    "value": {"type": "number", "description": "Deal value in dollars."},
                    "probability": {"type": "integer", "description": "Win probability, 0-100."},
                },
                "required": ["client_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Create a new sales order that fulfills a quantity of a product out of inventory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string"},
                    "item_name": {"type": "string", "description": "The product being ordered."},
                    "quantity": {"type": "integer"},
                },
                "required": ["customer_name", "item_name", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_low_stock_report",
            "description": "List inventory items that are at or below their reorder level.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

SYSTEM_PROMPT = """You are Ava, the voice assistant embedded in Nexus, a CRM/ERP system.
The person talking to you may speak English or Arabic. Listen to their spoken
command (given to you as text) and decide whether one of your tools can carry
it out. If so, call exactly ONE tool with the arguments extracted from what
they said. If nothing fits — small talk, an unclear request, or a question
you have no tool for — do NOT call a tool; just reply with one short,
friendly sentence in the same language the person used."""


@dataclass
class ToolResult:
    intent: str
    reply_text: str
    data: Optional[dict] = None


# =====================================================================
# Executors — one per tool, each calls db_queries.py and returns a
# ToolResult with a ready-to-speak reply_text.
# =====================================================================

async def _exec_check_inventory(args: dict) -> ToolResult:
    item = await db_queries.get_inventory_item_by_name(args.get("product_name", ""))
    if item:
        return ToolResult(
            "check_inventory",
            f"{item['name']} currently has {item['quantity']} units in {item['warehouse']} warehouse.",
            item,
        )
    return ToolResult("check_inventory", "I couldn't find that product in inventory.", None)


async def _exec_create_lead(args: dict) -> ToolResult:
    name = args.get("name") or "New Lead"
    lead = await db_queries.create_lead(
        name=name, company=args.get("company", ""), email=args.get("email", ""),
        phone=args.get("phone", ""), source="voice-assistant",
    )
    return ToolResult("create_lead", f"Created a new lead for {name}.", lead)


async def _exec_get_top_leads(args: dict) -> ToolResult:
    leads = await db_queries.get_top_leads(limit=3)
    names = ", ".join(l["client_name"] for l in leads) if leads else "none yet"
    return ToolResult("get_top_leads", f"Your top opportunities right now are: {names}.", {"leads": leads})


async def _exec_get_revenue_summary(args: dict) -> ToolResult:
    kpis = await db_queries.get_kpi_summary()
    return ToolResult(
        "get_revenue_summary",
        f"Total revenue is ${kpis['total_revenue']:,.0f}, "
        f"stock value is ${kpis['stock_value']:,.0f}, across {kpis['new_orders']} orders.",
        kpis,
    )


async def _exec_search_crm(args: dict) -> ToolResult:
    query = args.get("query", "")
    results = await db_queries.search_crm(query)
    found = len(results["leads"]) + len(results["accounts"])
    return ToolResult("search_crm", f"Found {found} matching record(s) for '{query}'.", results)


async def _exec_create_deal(args: dict) -> ToolResult:
    client_name = args.get("client_name") or "New Client"
    value = float(args.get("value") or 0)
    probability = int(args.get("probability") or 0)
    deal = await db_queries.create_deal(client_name=client_name, value=value, probability=probability)
    return ToolResult("create_deal", f"Created a new deal for {client_name} worth ${value:,.0f}.", deal)


async def _exec_create_order(args: dict) -> ToolResult:
    item = await db_queries.get_inventory_item_by_name(args.get("item_name", ""))
    if not item:
        return ToolResult("create_order", f"I couldn't find '{args.get('item_name')}' in inventory.", None)
    quantity = int(args.get("quantity") or 1)
    order = await db_queries.create_order(
        customer_name=args.get("customer_name") or "Voice Order",
        items=[{
            "inventory_item_id": item["id"], "item_name": item["name"],
            "quantity": quantity, "unit_price": item["unit_price"],
        }],
    )
    return ToolResult(
        "create_order",
        f"Created order {order['order_number']} for {quantity} x {item['name']}.",
        order,
    )


async def _exec_get_low_stock_report(args: dict) -> ToolResult:
    items = await db_queries.get_inventory(low_stock_only=True)
    if not items:
        return ToolResult("get_low_stock_report", "Nothing is low on stock right now.", {"items": items})
    names = ", ".join(i["name"] for i in items)
    return ToolResult("get_low_stock_report", f"{len(items)} item(s) are low on stock: {names}.", {"items": items})


_EXECUTORS = {
    "check_inventory": _exec_check_inventory,
    "create_lead": _exec_create_lead,
    "get_top_leads": _exec_get_top_leads,
    "get_revenue_summary": _exec_get_revenue_summary,
    "search_crm": _exec_search_crm,
    "create_deal": _exec_create_deal,
    "create_order": _exec_create_order,
    "get_low_stock_report": _exec_get_low_stock_report,
}


# =====================================================================
# LLM mode
# =====================================================================

async def _handle_with_llm(transcript: str) -> Optional[dict]:
    """Returns None (never a dict with an error) if the LLM call itself
    fails, so the caller can fall back to keyword matching transparently."""
    client = get_groq_client()
    if client is None:
        return None

    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": transcript},
            ],
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=300,
        )
    except Exception as exc:  # network issues, rate limits, bad key, etc.
        print(f"[ai_parser] Groq call failed, falling back to keywords: {exc}")
        return None

    message = response.choices[0].message
    tool_calls = getattr(message, "tool_calls", None)

    if not tool_calls:
        # The model decided no tool fits — just speak its plain-text reply.
        return {"intent": "chat", "reply_text": message.content or "Sorry, I didn't catch that.", "data": None}

    call = tool_calls[0]
    executor = _EXECUTORS.get(call.function.name)
    if not executor:
        return {"intent": "unknown", "reply_text": "I'm not able to do that yet.", "data": None}

    try:
        args = json.loads(call.function.arguments or "{}")
    except json.JSONDecodeError:
        args = {}

    result = await executor(args)
    return {"intent": result.intent, "reply_text": result.reply_text, "data": result.data}


# =====================================================================
# Keyword fallback mode (Step 3's original logic — kept as a safety net)
# =====================================================================

_INVENTORY_KEYWORDS = ["inventory", "stock", "كمية", "مخزون", "المخزن"]
_TOP_LEADS_KEYWORDS = ["top leads", "أفضل العملاء", "top opportunities", "افضل الفرص"]
_NEW_LEAD_KEYWORDS = ["new lead", "create a lead", "عميل جديد", "أضف عميل", "اضف عميل"]
_REVENUE_KEYWORDS = ["revenue", "الإيرادات", "المبيعات", "sales"]
_SEARCH_KEYWORDS = ["find account", "find lead", "search for", "ابحث عن", "دور على", "فين حساب"]


async def _keyword_fallback(transcript: str) -> dict:
    text = transcript.strip().lower()

    if any(k in text for k in _INVENTORY_KEYWORDS):
        match = re.search(r"(?:for|of|كمية)\s+(.*?)(?:\s+in|\s+في|$)", text)
        product_name = match.group(1).strip() if match else text
        result = await _exec_check_inventory({"product_name": product_name})
    elif any(k in text for k in _TOP_LEADS_KEYWORDS):
        result = await _exec_get_top_leads({})
    elif any(k in text for k in _NEW_LEAD_KEYWORDS):
        match = re.search(r"(?:lead|عميل)\s+(?:named|called|اسمه|باسم)?\s*(.*)", text)
        name = match.group(1).strip() if match and match.group(1).strip() else "New Lead"
        result = await _exec_create_lead({"name": name})
    elif any(k in text for k in _REVENUE_KEYWORDS):
        result = await _exec_get_revenue_summary({})
    elif any(k in text for k in _SEARCH_KEYWORDS):
        match = re.search(r"(?:find account|find lead|search for|ابحث عن|دور على|عميل|حساب)\s+(.*)", text)
        query = match.group(1).strip() if match and match.group(1).strip() else text
        result = await _exec_search_crm({"query": query})
    else:
        return {"intent": "unknown", "reply_text": "Sorry, I didn't understand that command yet.", "data": None}

    return {"intent": result.intent, "reply_text": result.reply_text, "data": result.data}


# =====================================================================
# Main entry point
# =====================================================================

async def handle_voice_command(transcript: str) -> dict:
    """Called by POST /api/ai/voice-command. Tries the LLM first (if
    configured), and falls back to keyword matching if it's unavailable."""
    llm_result = await _handle_with_llm(transcript)
    if llm_result is not None:
        return llm_result
    return await _keyword_fallback(transcript)
