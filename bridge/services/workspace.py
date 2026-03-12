
import json
import time
import os
import shutil
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

from bridge.config import (
    EXCHANGE_DIR, 
    BASE_JOBS_DIR,
    DOCKER_PREFIX, 
    WINDOWS_PREFIX, 
    LAUNCH_JS_PATH
)
from bridge.utils.logger import logger

class WorkspaceError(Exception):
    """Base exception for workspace related errors."""
    pass

class TimeoutError(WorkspaceError):
    """Raised when an operation times out."""
    pass

class ValidationError(WorkspaceError):
    """Raised when validation fails."""
    pass

def validate_secure_path(path: str, job_id: Optional[str] = None) -> Path:
    """
    Validates that the provided path is secure and stays within BASE_JOBS_DIR.
    Prevents Path Traversal attacks.
    """
    try:
        # 1. Normalize and resolve the path
        # If it's a job_id, we construct the path to exchange/jobs/{job_id}
        if job_id and not path.startswith(("/", "\\")):
             target_path = BASE_JOBS_DIR / job_id
        else:
             # It's a file path, possibly from Docker
             target_path = Path(normalize_path(path))
        
        # Resolve to absolute path to remove ../..
        resolved_path = target_path.resolve()
        resolved_base = BASE_JOBS_DIR.resolve()
        
        # 2. Check if the path starts with BASE_JOBS_DIR
        # Using relative_to is the safest way to check if a path is within another
        try:
            resolved_path.relative_to(resolved_base)
        except ValueError:
            logger.error(f"Security Violation: Path traversal attempt detected! Path: {path} (Resolved: {resolved_path})")
            raise PermissionError(f"Access Denied: Path is outside of allowed directory: {path}")
            
        return resolved_path
    except Exception as e:
        if isinstance(e, PermissionError):
            raise
        logger.error(f"Path validation error: {e}")
        raise ValidationError(f"Invalid path provided: {path}")

def normalize_path(docker_path: str) -> str:
    """
    Converts Docker path (/data/exchange/...) to Windows path (C:\\...\\exchange\\...).
    """
    # Replace forward slashes with backslashes
    path = docker_path.replace("/", "\\")
    
    # Remove the docker prefix if present and prepend local prefix
    # Note: DOCKER_PREFIX is /data/exchange, WINDOWS_PREFIX is ...\exchange
    docker_prefix_win = DOCKER_PREFIX.replace("/", "\\")
    
    if path.startswith(docker_prefix_win):
        # Remove the prefix and ensure no leading backslash for Path join
        relative_path = path[len(docker_prefix_win):].lstrip("\\")
        return str(EXCHANGE_DIR / relative_path)
    
    # If path starts with /data/ but not /data/exchange (edge case)
    if path.startswith("\\data\\"):
         # Try to map generically if needed, but stick to exchange for now
         pass

    return path

def prepare_job_workspace(job_id: str, file_path: str, commands: Dict[str, Any]) -> Tuple[Path, Path]:
    """
    Creates the job directory structure and writes the commands.json file.
    
    Args:
        job_id: The unique job identifier.
        file_path: The Docker path to the source file.
        commands: The dictionary of commands to execute.
        
    Returns:
        Tuple containing (commands_json_path, runner_script_path).
    """
    try:
        # Convert docker path to windows path
        windows_source_path = normalize_path(file_path)
        
        # Create job structure: exchange/jobs/{job_id}/input
        job_input_dir = BASE_JOBS_DIR / job_id / "input"
        job_input_dir.mkdir(parents=True, exist_ok=True)
        
        # Prepare commands.json path
        commands_file = job_input_dir / "commands.json"
        
        # Inject targetFile into commands if missing
        if "targetFile" not in commands:
            commands["targetFile"] = windows_source_path
        
        # Write commands.json
        with open(commands_file, "w", encoding="utf-8") as f:
            json.dump(commands, f, indent=2, ensure_ascii=False)
            
        logger.info(f"[{job_id}] Prepared workspace. Source: {windows_source_path}")
        
        # Determine runner script path (usually adjacent to bridge.py or in temp location)
        # We'll put it in the job input dir to keep things clean or use a temporary name
        # The original code put it in BASE_DIR / "runner.jsx". Let's stick to a predictable path 
        # or maybe make it unique per job to avoid conflicts if we ever go parallel (though COM is single threaded).
        # For now, let's keep it simple and consistent with original design but maybe unique name?
        # Actually, original code used a single runner.jsx path which is risky if we have concurrent requests waiting.
        # But since we have a lock, it's fine. Let's make it unique just in case.
        # Wait, the prompt says "Runner Creation: Logic for generating temporary runner.jsx".
        # Let's generate it in the job directory to be safe and clean.
        runner_script_path = job_input_dir / "runner.jsx"
        
        return commands_file, runner_script_path
        
    except Exception as e:
        logger.error(f"[{job_id}] Failed to prepare workspace: {e}")
        raise WorkspaceError(f"Failed to prepare workspace: {e}")

def create_runner_script(job_id: str, runner_script_path: Path) -> None:
    """
    Generates the runner.jsx script that calls the main ExtendScript logic.
    Ensures parent directory exists.
    """
    try:
        # Ensure parent directory exists
        runner_script_path.parent.mkdir(parents=True, exist_ok=True)
        
        # escape backslashes for JS string
        launch_js_path_str = str(LAUNCH_JS_PATH).replace("\\", "/")
        
        runner_content = f"""
        var CURRENT_JOB_ID = '{job_id}';
        $.evalFile('{launch_js_path_str}');
        """
        
        with open(runner_script_path, "w", encoding="utf-8") as f:
            f.write(runner_content)
            
        logger.info(f"[{job_id}] Created runner script at {runner_script_path}")
        
    except Exception as e:
        logger.error(f"[{job_id}] Failed to create runner script: {e}")
        raise WorkspaceError(f"Failed to create runner script: {e}")

def wait_for_input(commands_json_path: Path, source_ai_path: Optional[Path] = None, timeout: float = 30.0) -> None:
    """
    Waits for the commands.json file and optionally the source AI file to be ready (Handshake).
    """
    start_wait = time.perf_counter()
    logger.info(f"Waiting for input files: {commands_json_path}" + (f" and {source_ai_path}" if source_ai_path else ""))
    
    # Log absolute paths for debugging (once before loop)
    logger.info(f"DEBUG: Bridge checking path: {os.path.abspath(commands_json_path)}")
    if source_ai_path:
        logger.info(f"DEBUG: Bridge checking path: {os.path.abspath(source_ai_path)}")

    while True:
        commands_ready = commands_json_path.exists()
        source_ready = source_ai_path.exists() if source_ai_path else True
        
        # Additional debug check for parent directory
        if not source_ready and source_ai_path and source_ai_path.parent.exists():
             # Parent exists but file doesn't
             pass
        elif not source_ready and source_ai_path:
             # Even parent doesn't exist
             pass

        if commands_ready and source_ready:
            logger.info(f"All input files ready: {commands_json_path}")
            return
            
        if time.perf_counter() - start_wait >= timeout:
            missing = []
            if not commands_ready: missing.append(str(commands_json_path))
            if not source_ready: missing.append(str(source_ai_path))
            logger.error(f"Timeout waiting for input files: {', '.join(missing)}")
            raise TimeoutError(f"Timeout waiting for input files: {', '.join(missing)}")
            
        time.sleep(0.1)

def validate_output_pdf(job_id: str) -> Path:
    """
    Checks if the output PDF exists and is valid (size > 10KB).
    Returns the path to the valid PDF.
    """
    output_pdf_dir = BASE_JOBS_DIR / job_id / "output" / "pdf"
    
    if not output_pdf_dir.exists():
        logger.error(f"[{job_id}] PDF output directory not found: {output_pdf_dir}")
        raise ValidationError("Output directory not found")

    try:
        # Find the most recent PDF
        pdf_files = sorted(output_pdf_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    except Exception as e:
        logger.error(f"[{job_id}] Failed to access PDF files: {e}")
        raise ValidationError(f"Failed to access PDF files: {e}")

    if not pdf_files:
        logger.error(f"[{job_id}] No PDF generated in {output_pdf_dir}")
        raise ValidationError("No PDF generated")

    latest_pdf = pdf_files[0]
    
    try:
        pdf_size = latest_pdf.stat().st_size
    except Exception as e:
        logger.error(f"[{job_id}] Failed to read PDF size: {e}")
        raise ValidationError(f"Failed to read PDF size: {e}")

    # 10KB = 10 * 1024 bytes
    if pdf_size <= 0 or pdf_size < 10 * 1024:
        logger.error(f"[{job_id}] PDF too small: {latest_pdf} ({pdf_size} bytes)")
        raise ValidationError(f"Generated PDF is empty or corrupted (Size: {pdf_size} bytes)")

    return latest_pdf

def cleanup_job_workspace(job_id: str, runner_script_path: Optional[Path] = None):
    """
    Cleans up temporary files like the runner script.
    """
    if runner_script_path and runner_script_path.exists():
        try:
            os.remove(runner_script_path)
            logger.info(f"[{job_id}] Cleaned up runner script.")
        except Exception as e:
            logger.error(f"Failed to cleanup runner script: {e}")
