"""
auth.py
--------
FastAPI dependency that protects endpoints using Supabase Auth.

The frontend signs in directly against Supabase Auth (see frontend/js/auth.js)
and gets back a JWT access_token. Every subsequent API call sends that token
as "Authorization: Bearer <token>". This dependency verifies the token by
asking Supabase's Auth server who it belongs to — if it's missing, malformed,
or expired, the request is rejected with 401 before it ever reaches a router.

Apply it once per router via `dependencies=[Depends(get_current_user)]`
(see main.py) rather than on every individual endpoint.
"""
import asyncio

from fastapi import Header, HTTPException

from services.supabase_client import get_supabase


async def get_current_user(authorization: str = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1].strip()

    try:
        sb = get_supabase()
    except RuntimeError as exc:
        # Supabase isn't configured yet (.env missing) — a config problem,
        # not an auth problem, so it gets its own status code.
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        response = await asyncio.to_thread(sb.auth.get_user, token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = getattr(response, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user
