
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
    """Базовое исключение для ошибок, связанных с рабочим пространством."""
    pass

class TimeoutError(WorkspaceError):
    """Вызывается при превышении времени ожидания операции."""
    pass

class ValidationError(WorkspaceError):
    """Вызывается при ошибке валидации."""
    pass

def validate_secure_path(path: str, job_id: Optional[str] = None) -> Path:
    """
    Проверяет безопасность пути и его нахождение внутри BASE_JOBS_DIR.
    Предотвращает атаки типа Path Traversal.
    """
    try:
        # 1. Нормализация и разрешение пути
        # Если это job_id, строим путь к exchange/jobs/{job_id}
        if job_id and not path.startswith(("/", "\\")):
             target_path = BASE_JOBS_DIR / job_id
        else:
             # Это путь к файлу, возможно, из Docker
             target_path = Path(normalize_path(path))
        
        # Разрешение в абсолютный путь для удаления ../..
        resolved_path = target_path.resolve()
        resolved_base = BASE_JOBS_DIR.resolve()
        
        # 2. Проверка, начинается ли путь с BASE_JOBS_DIR
        # Использование relative_to — самый безопасный способ проверить вложенность путей
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
    Преобразует путь Docker (/data/exchange/...) в путь Windows (C:\\...\\exchange\\...).
    """
    # Замена прямых косых черт на обратные
    path = docker_path.replace("/", "\\")
    
    # Удаление префикса Docker, если он есть, и добавление локального префикса
    # Примечание: DOCKER_PREFIX — это /data/exchange, WINDOWS_PREFIX — ...\exchange
    docker_prefix_win = DOCKER_PREFIX.replace("/", "\\")
    
    if path.startswith(docker_prefix_win):
        # Удаление префикса и обеспечение отсутствия ведущего обратного слэша для Path join
        relative_path = path[len(docker_prefix_win):].lstrip("\\")
        return str(EXCHANGE_DIR / relative_path)
    
    # Если путь начинается с /data/, но не с /data/exchange (крайний случай)
    if path.startswith("\\data\\"):
         # Попытка общего сопоставления, если нужно, но пока придерживаемся exchange
         pass

    return path

def prepare_job_workspace(job_id: str, file_path: str, commands: Dict[str, Any]) -> Tuple[Path, Path]:
    """
    Создает структуру директорий задачи и записывает файл commands.json.
    
    Аргументы:
        job_id: Уникальный идентификатор задачи.
        file_path: Путь Docker к исходному файлу.
        commands: Словарь команд для выполнения.
        
    Возвращает:
        Кортеж, содержащий (путь_к_commands_json, путь_к_скрипту_раннера).
    """
    try:
        # Преобразование пути Docker в путь Windows
        windows_source_path = normalize_path(file_path)
        
        # Создание структуры задачи: exchange/jobs/{job_id}/input
        job_input_dir = BASE_JOBS_DIR / job_id / "input"
        job_input_dir.mkdir(parents=True, exist_ok=True)
        
        # Подготовка пути к commands.json
        commands_file = job_input_dir / "commands.json"
        
        # Добавление targetFile в команды, если он отсутствует
        if "targetFile" not in commands:
            commands["targetFile"] = windows_source_path
        
        # Запись commands.json
        with open(commands_file, "w", encoding="utf-8") as f:
            json.dump(commands, f, indent=2, ensure_ascii=False)
            
        logger.info(f"[{job_id}] Prepared workspace. Source: {windows_source_path}")

        runner_script_path = job_input_dir / "runner.jsx"
        
        return commands_file, runner_script_path
        
    except Exception as e:
        logger.error(f"[{job_id}] Failed to prepare workspace: {e}")
        raise WorkspaceError(f"Failed to prepare workspace: {e}")

def create_runner_script(job_id: str, runner_script_path: Path) -> None:
    """
    Генерирует скрипт runner.jsx, который вызывает основную логику ExtendScript.
    Обеспечивает существование родительской директории.
    """
    try:
        # Проверка существования родительской директории
        runner_script_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Экранирование обратных косых черт для строки JS
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
    Ожидает готовности файла commands.json и, опционально, исходного AI файла (Handshake).
    """
    start_wait = time.perf_counter()
    logger.info(f"Waiting for input files: {commands_json_path}" + (f" and {source_ai_path}" if source_ai_path else ""))
    
    # Логирование абсолютных путей для отладки (один раз перед циклом)
    logger.info(f"DEBUG: Bridge checking path: {os.path.abspath(commands_json_path)}")
    if source_ai_path:
        logger.info(f"DEBUG: Bridge checking path: {os.path.abspath(source_ai_path)}")

    while True:
        commands_ready = commands_json_path.exists()
        source_ready = source_ai_path.exists() if source_ai_path else True
        
        # Дополнительная отладочная проверка родительской директории
        if not source_ready and source_ai_path and source_ai_path.parent.exists():
             # Родитель существует, но файл — нет
             pass
        elif not source_ready and source_ai_path:
             # Даже родительская директория не существует
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
    Проверяет существование и валидность выходного PDF (размер > 10 КБ).
    Возвращает путь к валидному PDF.
    """
    output_pdf_dir = BASE_JOBS_DIR / job_id / "output" / "pdf"
    
    if not output_pdf_dir.exists():
        logger.error(f"[{job_id}] PDF output directory not found: {output_pdf_dir}")
        raise ValidationError("Output directory not found")

    try:
        # Поиск самого свежего PDF
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

    # 10 КБ = 10 * 1024 байт
    if pdf_size <= 0 or pdf_size < 10 * 1024:
        logger.error(f"[{job_id}] PDF too small: {latest_pdf} ({pdf_size} bytes)")
        raise ValidationError(f"Generated PDF is empty or corrupted (Size: {pdf_size} bytes)")

    return latest_pdf

def generate_inspect_runner(job_id: str) -> Path:
    """
    Генерирует временный inspect_runner.jsx для сканирования структуры документа.
    """
    try:
        job_input_dir = BASE_JOBS_DIR / job_id / "input"
        job_input_dir.mkdir(parents=True, exist_ok=True)
        
        runner_path = job_input_dir / "inspect_runner.jsx"
        
        # Пути для #include в ExtendScript
        # Нам нужны абсолютные пути с прямыми косых чертами для ExtendScript
        # Примечание: ожидается, что BASE_DIR определен в bridge.config или аналогичном месте
        from bridge.config import BASE_DIR
        main_js_path = (BASE_DIR / "src" / "core" / "main.js").resolve().as_posix()
        inspector_js_path = (BASE_DIR / "src" / "utils" / "modules" / "inspector.js").resolve().as_posix()
        
        runner_content = f"""
        var CURRENT_JOB_ID = '{job_id}';
        #include "{main_js_path}"
        #include "{inspector_js_path}"
        
        // Инициализация Config для задачи
        var scriptFile = new File($.fileName);
        var rootPath = scriptFile.parent.parent.parent.parent.fsName; // от exchange/jobs/id/input/ до корня
        Config.init(rootPath, CURRENT_JOB_ID);
        
        // Запуск инспекции
        Inspector.run();
        """
        
        with open(runner_path, "w", encoding="utf-8") as f:
            f.write(runner_content)
            
        logger.info(f"[{job_id}] Generated inspect runner at {runner_path}")
        return runner_path
        
    except Exception as e:
        logger.error(f"[{job_id}] Failed to generate inspect runner: {e}")
        raise WorkspaceError(f"Failed to generate inspect runner: {e}")

def read_structure_json(job_id: str) -> Dict[str, Any]:
    """
    Читает файл structure.json из директории output/logs задачи.
    """
    try:
        structure_file = BASE_JOBS_DIR / job_id / "output" / "logs" / "structure.json"
        
        if not structure_file.exists():
            logger.error(f"[{job_id}] Structure JSON not found at {structure_file}")
            raise WorkspaceError(f"Structure JSON not found for job {job_id}")
            
        with open(structure_file, "r", encoding="utf-8") as f:
            return json.load(f)
            
    except Exception as e:
        logger.error(f"[{job_id}] Failed to read structure JSON: {e}")
        raise WorkspaceError(f"Failed to read structure JSON: {e}")

def cleanup_job_workspace(job_id: str, runner_script_path: Optional[Path] = None):
    """
    Очищает временные файлы, такие как скрипт раннера.
    """
    if runner_script_path and runner_script_path.exists():
        try:
            os.remove(runner_script_path)
            logger.info(f"[{job_id}] Cleaned up runner script.")
        except Exception as e:
            logger.error(f"Failed to cleanup runner script: {e}")
