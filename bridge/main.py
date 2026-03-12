import re
import threading
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from bridge.models import JobRequest, StatusResponse
from bridge.utils.security import verify_api_key
from bridge.utils.logger import logger
from bridge.config import DEFAULT_JOB_TIMEOUT_SECONDS
from bridge.services.workspace import (
    normalize_path,
    validate_secure_path,
    prepare_job_workspace,
    create_runner_script,
    wait_for_input,
    validate_output_pdf,
    cleanup_job_workspace,
    WorkspaceError,
    ValidationError as WorkspaceValidationError,
    TimeoutError as WorkspaceTimeoutError,
)
from bridge.services.illustrator import (
    IllustratorService,
    IllustratorError,
    TimeoutError as IllustratorTimeoutError,
)
from bridge.utils.log_analyzer import analyze_job_log

app = FastAPI(title="Illustrator Bridge Service")

busy_lock = threading.Lock()
illustrator_service = IllustratorService(job_timeout_seconds=DEFAULT_JOB_TIMEOUT_SECONDS)


@app.on_event("startup")
async def on_startup():
    IllustratorService.force_cleanup()


@app.get("/status", response_model=StatusResponse)
async def get_status(_: str = Depends(verify_api_key)):
    is_locked = busy_lock.locked()
    return {"status": "busy" if is_locked else "idle", "is_busy": is_locked}


async def perform_job_processing(job: JobRequest):
    """
    Background task to process the job.
    """
    runner_script_path = None
    try:
        # 1. Prepare workspace (creates folders and commands.json)
        # Normalize the source file path
        source_ai_path = Path(normalize_path(job.file_path))
        
        commands_json_path, runner_script_path = prepare_job_workspace(job.job_id, job.file_path, job.commands)
        
        # 2. Create runner script
        create_runner_script(job.job_id, runner_script_path)
        
        # 3. Wait for input files (Handshake)
        # We wait for commands.json AND the source AI file which is copied by the test.
        wait_for_input(commands_json_path, source_ai_path=source_ai_path, timeout=30.0)
        
        # 4. Run Illustrator
        await illustrator_service.run_script_with_watchdog(runner_script_path, job.job_id)
        
        # 5. Validate result
        validate_output_pdf(job.job_id)
        logger.info(f"[{job.job_id}] Background job completed successfully")
        
    except (WorkspaceTimeoutError, IllustratorTimeoutError) as e:
        logger.error(f"[{job.job_id}] Background job TIMEOUT: {e}")
        analyze_job_log(job.job_id) # Log analysis if possible
    except (WorkspaceValidationError, WorkspaceError, IllustratorError) as e:
        logger.error(f"[{job.job_id}] Background job ERROR: {e}")
        analyze_job_log(job.job_id)
    except Exception as e:
        logger.error(f"[{job.job_id}] Background job UNEXPECTED ERROR: {e}")
    finally:
        cleanup_job_workspace(job.job_id, runner_script_path)
        if busy_lock.locked():
            busy_lock.release()
            logger.info(f"[{job.job_id}] Released lock")


@app.post("/process")
async def process_job(
    job: JobRequest,
    background_tasks: BackgroundTasks,
    _: str = Depends(verify_api_key),
):
    if busy_lock.locked():
        raise HTTPException(status_code=429, detail="Service is busy processing another job")
    
    # Path Traversal Validation
    try:
        # 1. Validate Job ID path (must be within jobs directory)
        validate_secure_path(job.job_id, job_id=job.job_id)
        
        # 2. Validate Source File path (must be within exchange directory via Docker mapping)
        validate_secure_path(job.file_path)
        
    except PermissionError as e:
        logger.error(f"Security Warning: Access Denied for job_id={job.job_id} file_path={job.file_path}. Error: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except WorkspaceValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not re.match(r"^[\w-]+$", job.job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID format")

    acquired = busy_lock.acquire(blocking=False)
    if not acquired:
        raise HTTPException(status_code=429, detail="Service is busy processing another job")

    logger.info(f"[{job.job_id}] Lock acquired, starting background task")
    background_tasks.add_task(perform_job_processing, job)
    
    return {"status": "success", "job_id": job.job_id, "message": "Job accepted and processing in background"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
