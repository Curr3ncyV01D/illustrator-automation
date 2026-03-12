
from typing import Dict, Any
from pydantic import BaseModel

class JobRequest(BaseModel):
    job_id: str
    file_path: str
    commands: Dict[str, Any]

class StatusResponse(BaseModel):
    status: str
    is_busy: bool
