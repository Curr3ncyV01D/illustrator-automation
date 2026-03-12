
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

# --- Configuration ---
# Detect current directory (assuming this file is in bridge/)
# So BASE_DIR should be the parent of this file's parent (illustrator-automation root)
# bridge/config.py -> parent = bridge -> parent = root
BASE_DIR = Path(__file__).parent.parent.absolute()

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "bridge.log"

# Using 'exchange' for Docker volume mapping, 'dev' for local development assets
EXCHANGE_DIR = BASE_DIR / "exchange"
DEV_DIR = BASE_DIR / "dev"
BASE_JOBS_DIR = EXCHANGE_DIR / "jobs" # Follows the new structure: exchange/jobs/{job_id}/input
INPUT_DIR = BASE_JOBS_DIR
LAUNCH_JS_PATH = BASE_DIR / "launch.js"

# Environment Variables
DEFAULT_JOB_TIMEOUT_SECONDS = int(os.getenv("BRIDGE_JOB_TIMEOUT_SECONDS", "300"))
EXPECTED_API_KEY = os.getenv("BRIDGE_API_KEY", "dev-key")

# Docker Path Mapping
# We map /data/exchange to local exchange folder
DOCKER_PREFIX = "/data/exchange"
WINDOWS_PREFIX = str(EXCHANGE_DIR)

# Illustrator COM Constants
AI_DONT_DISPLAY_ALERTS = -1  # UserInteractionLevel.dontDisplayAlerts
