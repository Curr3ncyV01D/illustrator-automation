
from fastapi import Header, HTTPException
from typing import Optional
from bridge.config import EXPECTED_API_KEY

async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    """
    Проверяет заголовок X-API-Key на соответствие ожидаемому API-ключу.
    Выбрасывает HTTPException(401), если ключ невалиден.
    """
    if x_api_key != EXPECTED_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_api_key
