
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

# --- Конфигурация ---
# Определение текущей директории (предполагается, что этот файл находится в bridge/)
# Таким образом, BASE_DIR должен быть родителем родителя этого файла (корень illustrator-automation)
# bridge/config.py -> parent = bridge -> parent = root
BASE_DIR = Path(__file__).parent.parent.absolute()

# Директории проекта
SRC_DIR = BASE_DIR / "src"
EXCHANGE_DIR = BASE_DIR / "exchange"
DEV_DIR = BASE_DIR / "dev"

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "bridge.log"

# Использование 'exchange' для маппинга томов Docker, 'dev' для локальных ресурсов разработки
BASE_JOBS_DIR = EXCHANGE_DIR / "jobs" # Соответствует новой структуре: exchange/jobs/{job_id}/input
INPUT_DIR = BASE_JOBS_DIR

# Переменные окружения
DEFAULT_JOB_TIMEOUT_SECONDS = int(os.getenv("BRIDGE_JOB_TIMEOUT_SECONDS", "300"))
EXPECTED_API_KEY = os.getenv("BRIDGE_API_KEY", "dev-key")

# Маппинг путей Docker
# Мы маппим /data/exchange на локальную папку exchange
DOCKER_PREFIX = "/data/exchange"
WINDOWS_PREFIX = str(EXCHANGE_DIR)

# Константы Illustrator COM
AI_DONT_DISPLAY_ALERTS = -1  # UserInteractionLevel.dontDisplayAlerts
