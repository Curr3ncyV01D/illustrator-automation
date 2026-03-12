
import asyncio
import time
import subprocess
import pythoncom
import win32com.client
import psutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from bridge.utils.logger import logger
from bridge.config import AI_DONT_DISPLAY_ALERTS

class IllustratorError(Exception):
    """Base exception for Illustrator service errors."""
    pass

class TimeoutError(IllustratorError):
    """Raised when a job times out."""
    pass

class IllustratorService:
    """
    Manages the Adobe Illustrator COM object and process execution.
    """
    def __init__(self, job_timeout_seconds: int):
        self.app = None
        self.job_timeout_seconds = job_timeout_seconds
        self._executor = ThreadPoolExecutor(max_workers=1)

    def _init_com(self):
        """Initializes the COM library for the current thread."""
        try:
            pythoncom.CoInitialize()
            return True
        except Exception as e:
            logger.error(f"Failed to initialize COM: {e}")
            return False

    def _release_com(self):
        """Releases the COM library for the current thread."""
        pythoncom.CoUninitialize()

    def _get_or_start_illustrator(self):
        """
        Gets the active Illustrator instance or starts a new one.
        This method should be called within a COM-initialized thread.
        """
        try:
            self.app = win32com.client.GetActiveObject("Illustrator.Application")
            logger.info("Connected to existing Illustrator instance.")
        except pythoncom.com_error:
            logger.info("Illustrator not running, starting new instance...")
            self.app = win32com.client.Dispatch("Illustrator.Application")
            time.sleep(5)
        
        self.app.UserInteractionLevel = AI_DONT_DISPLAY_ALERTS
        return self.app

    def _run_script_task(self, runner_path: Path, job_id: str):
        """
        The actual task that runs in a separate thread to interact with Illustrator.
        """
        if not self._init_com():
            raise IllustratorError("COM initialization failed.")
        
        try:
            logger.info(f"[{job_id}] Connecting to Illustrator...")
            self._get_or_start_illustrator()
            
            logger.info(f"[{job_id}] Executing Runner Script: {runner_path}")
            self.app.DoJavaScriptFile(str(runner_path))
            logger.info(f"[{job_id}] Script execution finished.")
            
        except Exception as e:
            logger.error(f"[{job_id}] COM Error during script execution: {e}")
            raise IllustratorError(f"Script execution failed: {e}")
        finally:
            self._release_com()

    async def run_script_with_watchdog(self, runner_path: Path, job_id: str):
        """
        Executes the Illustrator script in a separate thread with a timeout (watchdog).
        This is an async method that can be awaited from the FastAPI event loop.
        """
        if not runner_path.exists():
            raise IllustratorError(f"Runner script not found at {runner_path}")

        loop = asyncio.get_running_loop()
        
        try:
            logger.info(f"[{job_id}] Starting job with a {self.job_timeout_seconds}s timeout.")
            
            await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._run_script_task,
                    runner_path,
                    job_id
                ),
                timeout=self.job_timeout_seconds
            )
            
            logger.info(f"[{job_id}] Job completed within timeout.")
        except asyncio.TimeoutError:
            elapsed = self.job_timeout_seconds
            logger.error(f"[{job_id}] TIMEOUT reached ({elapsed}s). Killing process.")
            self.force_cleanup()
            raise TimeoutError(f"Job timed out after {elapsed} seconds and process was killed.")
        except Exception as e:
            logger.error(f"[{job_id}] An unexpected error occurred in the execution thread: {e}")
            self.force_cleanup()
            raise IllustratorError(f"Job failed with an unexpected error: {e}")

    @staticmethod
    def force_cleanup():
        """
        Finds and forcefully terminates all Illustrator.exe processes.
        """
        logger.warning("Attempting to forcefully terminate all Illustrator processes...")
        killed_count = 0
        for p in psutil.process_iter(["name", "pid"]):
            if p.info.get("name", "").lower() == "illustrator.exe":
                try:
                    proc = psutil.Process(p.info["pid"])
                    proc.terminate()
                    logger.info(f"Terminated Illustrator process with PID: {p.info['pid']}")
                    killed_count += 1
                except psutil.NoSuchProcess:
                    logger.warning(f"Process with PID {p.info['pid']} no longer exists.")
                except Exception as e:
                    logger.error(f"Failed to terminate process {p.info['pid']}: {e}")
        
        if killed_count > 0:
            logger.info(f"Successfully terminated {killed_count} Illustrator process(es).")
        else:
            logger.info("No running Illustrator processes found to terminate.")
            
        try:
            gone, alive = psutil.wait_procs(
                [p for p in psutil.process_iter() if p.name().lower() == "illustrator.exe"], 
                timeout=5
            )
            if alive:
                logger.warning(f"Some Illustrator processes are still alive: {[p.pid for p in alive]}")
                for p in alive:
                    p.kill()
                logger.info("Sent kill signal to remaining processes.")
        except Exception as e:
            logger.error(f"Error while waiting for processes to terminate: {e}")

    def shutdown(self):
        """Shuts down the thread pool executor."""
        self._executor.shutdown(wait=True)
