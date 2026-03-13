
from pathlib import Path
from typing import Optional
from bridge.config import EXCHANGE_DIR
from bridge.utils.logger import logger

def analyze_job_log(job_id: str) -> Optional[str]:
    """
    Читает последние 10 строк лог-файла задачи и ищет известные ключевые слова ошибок.
    Возвращает конкретное сообщение об ошибке, если оно найдено, иначе None.
    """
    log_dir = EXCHANGE_DIR / "jobs" / job_id / "output" / "logs"
    if not log_dir.exists():
        return None
        
    try:
        # Поиск самого свежего лог-файла
        log_files = sorted(log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not log_files:
            return None
            
        latest_log = log_files[0]
        
        # Чтение последних 10 строк
        with open(latest_log, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            last_lines = lines[-10:] if len(lines) > 10 else lines
            content = "".join(last_lines)
            
        # Проверка ключевых слов
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
                
        # Также возвращаем последнюю строку с ошибкой, если она содержит "Error"
        for line in reversed(last_lines):
            if "Error" in line or "Exception" in line:
                return f"Script Error: {line.strip()}"
                
    except Exception as e:
        logger.error(f"[{job_id}] Failed to analyze log: {e}")
        
    return None
