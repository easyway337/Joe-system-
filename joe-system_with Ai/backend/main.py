"""
Joe System (Nexus AI CRM & ERP)
Backend entry point.

Run with:  uvicorn main:app --reload --port 8000
"""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import crm, erp, ai_assistant, analytics
from services.auth import get_current_user

app = FastAPI(
    title="Nexus AI CRM & ERP",
    description="Backend API for the Joe System (Nexus) CRM/ERP platform with an AI voice assistant.",
    version="0.1.0",
)

# Allow the Vanilla JS frontend to call the API from ANY origin — this matters
# because the frontend and backend are often served on two different preview
# URLs in cloud IDEs (Google IDX, Codespaces, etc.), not just localhost.
# allow_credentials is False on purpose: the frontend never sends cookies, and
# allow_origins=["*"] + allow_credentials=True is rejected by browsers anyway.
# Tighten allow_origins to your real frontend origin(s) before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every feature area lives in its own router -> keeps main.py thin.
# CRM, ERP, analytics, and the AI assistant all touch business data, so every
# endpoint in these routers requires a valid Supabase session (Step 7).
_auth = [Depends(get_current_user)]
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"], dependencies=_auth)
app.include_router(crm.router, prefix="/api/crm", tags=["CRM"], dependencies=_auth)
app.include_router(erp.router, prefix="/api/erp", tags=["ERP"], dependencies=_auth)
app.include_router(ai_assistant.router, prefix="/api/ai", tags=["AI Assistant"], dependencies=_auth)


@app.get("/api/health", tags=["System"])
async def health_check() -> dict:
    """Simple liveness check used by the frontend on load. Deliberately NOT
    behind auth — it's just a "is the server up" probe."""
    return {"status": "ok", "system": "Nexus AI CRM & ERP"}

