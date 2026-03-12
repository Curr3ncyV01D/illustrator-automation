# Руководство по интеграционному тесту `test_integration.py`

## 1. Overview

- Назначение: проверка полной цепочки автоматизации Illustrator — от Python Bridge до ExtendScript и выполнения операций в Adobe Illustrator с генерацией выходных файлов (AI/PDF) и логов.
- Местоположение теста: `test_integration.py` в корне проекта или в подкаталоге (скрипт автоматически определяет корень проекта).

## 2. How to Run

- Базовый запуск (используя файл команд по умолчанию):

```bash
python test_integration.py
```

- Запуск с конкретным JSON-файлом команд:

```bash
python test_integration.py --test dev/tests/complexCommand.json
```

- Важно: перед запуском теста необходимо запустить Python Bridge. В проекте основной сервис расположен в папке `bridge/`, порт по умолчанию `8000`.

```bash
# Запуск модульного сервиса через uvicorn
python -m uvicorn bridge.main:app --host 0.0.0.0 --port 8000
```

## 3. Test Logic

### Подготовка среды
- Генерируется уникальный `job_id` формата `TEST-DD-MM-T-HH-MM-SS`.
- Создаётся структура папок в `exchange/jobs/{job_id}/`:
  - `input/source_files/` — исходные AI-файлы
  - `input/components/` — компоненты (копируются из `dev/input/components/`, если есть)
  - `output/ai/`, `output/pdf/`, `output/logs/` — выходные данные
- Копируется `template.ai` (или указанный `targetFile`) из `dev/input/source_files/` в `input/source_files/`.
- Команды:
  - Если указан аргумент `--test`, JSON-файл команд читается из указанного пути.
  - Эти команды включаются в `payload` и отправляются в Bridge; сам Bridge кладёт `commands.json` в `exchange/jobs/{job_id}/input/`.

### Отправка запроса
- Формируется `payload`:
  - `job_id`: уникальный идентификатор задачи.
  - `file_path`: Docker-путь к исходному AI-файлу: `/data/exchange/jobs/{job_id}/input/source_files/{targetFile}`.
  - `commands`: объект JSON с операциями и параметрами.
- Отправка POST-запроса:

```python
requests.post("http://localhost:8000/process", json=payload, timeout=95)
```

### Обработка ответа
- `200 OK`:
  - Bridge принял задачу.
  - Запускается ожидание PDF (polling).
  - По нахождению PDF тест завершается успехом.
- `429 Busy`:
  - Bridge занят другим заданием.
  - Ожидание PDF не запускается.
  - Для диагностики читается хвост системного лога Bridge (`logs/bridge.log`).
  - Тест завершается с ошибкой.
- Другие ошибки (например, `500`, сетевые исключения):
  - Тест выводит код/текст ошибки.
  - Пытается прочитать лог задачи из `output/logs/`.
  - Завершается с ошибкой.

### Ожидание результата (Polling)
- Проверка наличия PDF в `exchange/jobs/{job_id}/output/pdf/`.
- Таймаут ожидания: 180 секунд.
- Интервал проверки: 2 секунды.
- По истечении таймаута:
  - Выводится сообщение о таймауте.
  - Пытается прочитать последний лог задачи из `output/logs/`.

## 4. Key Considerations

- Пути и маппинг:
  - Bridge использует Docker-префикс `/data/exchange/...`, который маппируется на Windows-путь директории `exchange` в корне проекта.
  - Пример соответствия: `/data/exchange/jobs/{job_id}/...` ↔ `C:\...\illustrator-automation\exchange\jobs\{job_id}\...`
- Очистка:
  - Папка `exchange/jobs/{job_id}/` сохраняется по умолчанию для отладки.
  - В `finally` можно включить очистку: `shutil.rmtree(job_dir, ignore_errors=True)` (по умолчанию закомментировано).
- Логи:
  - Логи задачи (ExtendScript): `exchange/jobs/{job_id}/output/logs/` — смотреть последний `.log`.
  - Системный лог Bridge: `logs/bridge.log` (основной путь) или `bridge.log` (фолбек).

## 5. Capabilities & Extension

- Запуск любого JSON:
  - Можно создать любой файл команд в соответствии с мастер-схемой [`src/schemas/main.schema.json`](../src/schemas/main.schema.json) и запустить его через `--test`.
  - Пример:

```json
{
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
```

- Добавление новых тестов:
  - Создайте новый JSON-файл в `dev/tests/`, например `dev/tests/replaceObject_basic.json`.
  - Запустите: `python test_integration.py --test dev/tests/replaceObject_basic.json`.

- Параметры команд:
  - В `commands.json` можно указывать параметры операций и дополнительные поля.
  - Поле `targetFile` управляет целевым AI-файлом из `input/source_files/` (например, для операций замены `replaceObject`).
  - Подробнее о допустимых полях — в схемах `src/schemas/*.schema.json` и `src/schemas/common.json`.

---

### Быстрая памятка
- Запустить Bridge: `python bridge.py` (порт 8000).
- Запустить тест по умолчанию: `python test_integration.py`.
- Запустить с вашим JSON: `python test_integration.py --test dev/tests/your.json`.
- Проверить результат: `exchange/jobs/{job_id}/output/pdf/`.
- Смотреть логи: `exchange/jobs/{job_id}/output/logs/` и `logs/bridge.log`.

