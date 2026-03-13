
import logging
import sys
from bridge.config import LOG_FILE

def setup_logger(name: str = "Bridge") -> logging.Logger:
    """Настраивает и возвращает стандартный логгер проекта."""
    
    # Настройка корневого логгера или создание нового
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Предотвращение повторного добавления обработчиков, если они уже настроены
    if not logger.handlers:
        # Обработчик файла (File Handler)
        file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
        
        # Обработчик консоли (Console Handler)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
        
    return logger

# Создание экземпляра логгера по умолчанию
logger = setup_logger()
