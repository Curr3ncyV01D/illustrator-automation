
from pathlib import Path
from typing import Optional
from bridge.config import EXCHANGE_DIR
from bridge.utils.logger import logger

def analyze_job_log(job_id: str) -> Optional[str]:
    """
    Reads the last 10 lines of the job's log file and checks for known error keywords.
    Returns a specific error message if found, otherwise None.
    """
    log_dir = EXCHANGE_DIR / "jobs" / job_id / "output" / "logs"
    if not log_dir.exists():
        return None
        
    try:
        # Find the most recent log file
        log_files = sorted(log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not log_files:
            return None
            
        latest_log = log_files[0]
        
        # Read last 10 lines
        with open(latest_log, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            last_lines = lines[-10:] if len(lines) > 10 else lines
            content = "".join(last_lines)
            
        # Check for keywords
        error_keywords = {
            "Font not found": "Font missing in document",
            "Version mismatch": "Illustrator version mismatch",
            "Missing Link": "Linked file is missing",
            "Error opening file": "Failed to open Illustrator file"
        }
        
        for keyword, message in error_keywords.items():
            if keyword in content:
                logger.warning(f"[{job_id}] Detected known error in log: {keyword}")
                return message
                
        # Also return the last error line if it contains "Error"
        for line in reversed(last_lines):
            if "Error" in line or "Exception" in line:
                return f"Script Error: {line.strip()}"
                
    except Exception as e:
        logger.error(f"[{job_id}] Failed to analyze log: {e}")
        
    return None
