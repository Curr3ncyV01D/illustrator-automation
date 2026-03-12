import os
import shutil
import uuid
import json
import time
import requests
import argparse
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Configuration
BASE_URL = "http://localhost:8000"
API_KEY = os.getenv("BRIDGE_API_KEY", "dev-key")
def _detect_project_root() -> Path:
    here = Path(__file__).resolve()
    for p in [here.parent, *here.parents]:
        if (p / "bridge").is_dir() or (p / "requirements.txt").exists():
            return p.absolute()
    try:
        return here.parents[2].absolute()
    except Exception:
        return here.parent.absolute()

PROJECT_ROOT = _detect_project_root()
EXCHANGE_DIR = PROJECT_ROOT / "exchange"
DEV_DIR = PROJECT_ROOT / "dev"

def test_integration(test_file_path=None):
    # 1. Load commands from file
    if test_file_path:
        test_file = Path(test_file_path)
        if not test_file.is_absolute():
            test_file = PROJECT_ROOT / test_file
            
        if not test_file.exists():
            print(f"Error: Test file not found at {test_file}")
            return
            
        print(f"Loading commands from: {test_file}")
        with open(test_file, "r", encoding="utf-8") as f:
            commands_data = json.load(f)
    else:
        # Fallback if no file provided (should not happen with default arg)
        print("No test file provided, using default hardcoded commands.")
        commands_data = {
            "version": "1.0",
            "targetFile": "template.ai",
            "operations": [
                {
                    "id": "op_resize_1",
                    "type": "resize",
                    "target": "Rectangle",
                    "parameters": {
                        "width": { "value": 150, "unit": "mm", "action": "set" },
                        "height": { "value": 150, "unit": "mm", "action": "set" }
                    }
                }
            ]
        }

    # 2. Generate ID
    now = datetime.now()
    job_id = f"TEST-{now.day:02d}-{now.month:02d}-T-{now.hour:02d}-{now.minute:02d}-{now.second:02d}"
    print(f"Generated job_id: {job_id}")
    target_filename = commands_data.get("targetFile", "template.ai")

    # 2.5 Check Bridge status before preparation
    print("Checking Bridge status...")
    max_status_attempts = 3
    headers = {"X-API-Key": API_KEY}
    
    server_busy = False
    for attempt in range(max_status_attempts):
        try:
            status_resp = requests.get(f"{BASE_URL}/status", headers=headers, timeout=5)
            
            if status_resp.status_code == 200:
                status_data = status_resp.json()
                if not status_data.get("is_busy", True):
                    print("Bridge is idle, proceeding...")
                    server_busy = False
                    break
                else:
                    print(f"⏳ Сервер занят обработкой другой задачи. Ожидание 5 сек... (попытка {attempt + 1}/{max_status_attempts})")
                    server_busy = True
            elif status_resp.status_code == 401:
                print(f"❌ ОШИБКА АВТОРИЗАЦИИ: Ваш BRIDGE_API_KEY не совпадает с ключом сервера. Проверьте .env файл.")
                return False
            elif status_resp.status_code == 429:
                print(f"⏳ Сервер занят обработкой другой задачи. Ожидание 5 сек... (попытка {attempt + 1}/{max_status_attempts})")
                server_busy = True
            else:
                detail = ""
                try:
                    detail = f" - {status_resp.json().get('detail', '')}"
                except:
                    pass
                print(f"❌ ОШИБКА СЕРВЕРА [{status_resp.status_code}]: {status_resp.text}{detail}")
                return False
                
        except Exception as e:
            print(f"Status check error: {e}. Waiting 5s...")
            server_busy = True
        
        if attempt < max_status_attempts - 1:
            time.sleep(5)
    
    if server_busy:
        print("Server is too busy, skipping preparation.")
        return False

    # 3. Create workspace BEFORE sending request to Bridge
    # This avoids race conditions where Bridge starts checking before Test creates files
    print("Создаю рабочую область...")
    sys.path.append(str(PROJECT_ROOT))
    try:
        from dev.utils.mock_workspace_builder import prepare_job_workspace
    except Exception as e:
        print(f"Ошибка импорта mock_workspace_builder: {e}")
        return False
        
    try:
        workspace_paths = prepare_job_workspace(
            job_id,
            commands_data,
            target_filename,
            copy_components=False,
        )
    except FileNotFoundError as e:
        print(str(e))
        return False
    except Exception as e:
        print(f"Ошибка подготовки рабочей области: {e}")
        return False
        
    output_pdf_dir = workspace_paths["output_pdf_dir"]
    output_logs_dir = workspace_paths["output_logs_dir"]

    # 4. Request to Bridge
    # Docker path format
    # We map /data/exchange to local exchange folder
    docker_file_path = f"/data/exchange/jobs/{job_id}/input/source_files/{target_filename}"
    
    payload = {
        "job_id": job_id,
        "file_path": docker_file_path,
        "commands": commands_data
    }
    
    print(f"Sending POST request to {BASE_URL}/process")
    try:
        # Формируем заголовки безопасности
        headers = {"X-API-Key": API_KEY}
        # Отправляем запрос с заголовками
        response = requests.post(f"{BASE_URL}/process", json=payload, headers=headers, timeout=95)
        if response.status_code == 200:
            print("Bridge принял задачу. Запускаю ожидание PDF...")
            time_of_waiting = os.getenv("BRIDGE_JOB_TIMEOUT_SECONDS", "180")
            timeout = int(time_of_waiting)
            interval = 2
            start_time = time.time()
            while time.time() - start_time < timeout:
                pdf_files = list(output_pdf_dir.glob("*.pdf"))
                if pdf_files:
                    print(f"\nУспех: найден PDF файл: {pdf_files[0]}")
                    return True
                time.sleep(interval)
                print(".", end="", flush=True)
            print(f"\nТаймаут ожидания PDF ({timeout} секунд). PDF не найден.")
            log_files = sorted(output_logs_dir.glob("*.log"), key=os.path.getmtime)
            if log_files:
                last_log = log_files[-1]
                print(f"Чтение лога задачи: {last_log}")
                try:
                    with open(last_log, "r", encoding="utf-8", errors="replace") as f:
                        print(f.read())
                except Exception as e:
                    print(f"Ошибка чтения лога задачи: {e}")
            else:
                print("Логи задачи не найдены в output/logs/")
            return False
        elif response.status_code == 429:
            detail = None
            try:
                detail = response.json().get("detail")
            except Exception:
                pass
            print(f"Bridge занят (429). Детали: {detail}")
            
            # Cleanup workspace if 429
            job_dir = EXCHANGE_DIR / "jobs" / job_id
            if job_dir.exists():
                print(f"Cleaning up unused workspace: {job_dir}")
                shutil.rmtree(job_dir, ignore_errors=True)

            bridge_log_path = PROJECT_ROOT / "logs" / "bridge.log"
            if not bridge_log_path.exists():
                bridge_log_path = PROJECT_ROOT / "bridge.log"
            if bridge_log_path.exists():
                print(f"Хвост bridge.log (последние 20 строк):")
                try:
                    with open(bridge_log_path, "r", encoding="utf-8", errors="replace") as f:
                        lines = f.readlines()
                        print("".join(lines[-20:]))
                except Exception as e:
                    print(f"Ошибка чтения bridge.log: {e}")
            else:
                print("bridge.log не найден.")
            return False
        else:
            detail = ""
            try:
                detail = f" - {response.json().get('detail', '')}"
            except:
                pass
            print(f"❌ ОШИБКА СЕРВЕРА [{response.status_code}]: {response.text}{detail}")
            
            output_logs_dir = EXCHANGE_DIR / "jobs" / job_id / "output" / "logs"
            log_files = sorted(output_logs_dir.glob("*.log"), key=os.path.getmtime) if output_logs_dir.exists() else []
            if log_files:
                last_log = log_files[-1]
                print(f"Чтение лога задачи: {last_log}")
                try:
                    with open(last_log, "r", encoding="utf-8", errors="replace") as f:
                        print(f.read())
                except Exception as e:
                    print(f"Ошибка чтения лога задачи: {e}")
            else:
                print("Логи задачи не найдены в output/logs/")
            return False
    except requests.exceptions.RequestException as e:
        print(f"Сетевая ошибка/таймаут при запросе к Bridge: {e}")
        return False
    finally:
        pass
        # shutil.rmtree(job_dir, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run integration test with a specific JSON command file.")
    parser.add_argument("--test", type=str, default="dev/tests/test_01_basic_ops.json", 
                        help="Path to the JSON test file (default: dev/tests/test_01_basic_ops.json)")
    
    args = parser.parse_args()
    test_integration(args.test)
