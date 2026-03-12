
from fastapi import Header, HTTPException
from typing import Optional
from bridge.config import EXPECTED_API_KEY

async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """
    Verifies the X-API-Key header against the expected API key.
    Raises HTTPException(401) if invalid.
    """
    if x_api_key != EXPECTED_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key
