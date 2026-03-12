# Архитектура системы: Bridge и Dynamic Runner

В этом документе описана архитектура Python-сервиса (Bridge) и механизма Dynamic Runner для интеграции Adobe Illustrator с n8n (Docker).

## Обзор

Система состоит из трех основных компонентов:

1.  **n8n (Docker)** — Оркестратор бизнес-процессов. Генерирует JSON-команды и отправляет их на Bridge.
2.  **Bridge Service (Python)** — HTTP-сервер на FastAPI. Принимает запросы, управляет очередью задач и запускает Illustrator через COM (ActiveX).
3.  **Adobe Illustrator (ExtendScript)** — Выполняет графические операции.

## 1. Bridge Service (`bridge/`)

Сервис представляет собой модульное FastAPI приложение, расположенное в директории `bridge/`.

### Структура Bridge

*   `bridge/main.py` — Точка входа в приложение.
*   `bridge/services/` — Бизнес-логика (взаимодействие с Illustrator, управление рабочей областью).
*   `bridge/utils/` — Вспомогательные утилиты (логирование, анализ логов, безопасность).
*   `bridge/models.py` — Pydantic модели для API.

### Запуск

```bash
# Рекомендуемый способ запуска через uvicorn
python -m uvicorn bridge.main:app --host 0.0.0.0 --port 8000
```

Сервер доступен по адресу `http://localhost:8000`.

### Эндпоинты

#### `POST /process`

Запускает обработку задачи.

**Параметры (JSON):**

*   `job_id` (string): Уникальный идентификатор задачи.
*   `file_path` (string): Путь к файлу AI (в формате Docker, например `/data/exchange/...`).
*   `commands` (object): JSON-объект с командами для Illustrator.

#### `GET /status`

Возвращает текущий статус сервиса и информацию о занятости.

## 2. Dynamic Runner (Механизм выполнения)

Мы используем метод "Dynamic Runner" для максимальной стабильности и изоляции задач.

### Алгоритм работы

1.  Bridge получает запрос `/process`.
2.  Сохраняет JSON с командами в `exchange/jobs/{job_id}/input/commands.json`.
3.  Генерирует скрипт `runner.jsx`, который вызывает `src/core/main.js`.
4.  Запускает `runner.jsx` через COM.
5.  `src/core/main.js` инициализирует окружение, читает команды и выполняет их.

## 3. Архитектурные паттерны (Facade)

Для упрощения взаимодействия между модулями и сокрытия внутренней сложности в проекте используется паттерн **Facade** (Фасад).
Это особенно важно для ExtendScript (ES3), где отсутствует нативная система модулей, и порядок подключения файлов (`#include`) имеет критическое значение.

### Преимущества Facade в ExtendScript

*   **Минимизация `#include`**: Вместо подключения 3-5 файлов в каждом модуле достаточно подключить один файл-фасад.
*   **Инкапсуляция логики**: Внутренняя структура (например, разделение валидаторов на файлы) скрыта от потребителя.
*   **Предотвращение конфликтов**: Глобальные переменные инициализируются централизованно.

### Config Facade (`src/config/config.js`)

Этот файл является единой точкой доступа к конфигурации приложения. Он объединяет:
*   `constants.js` (Константы)
*   `defaultSettings.js` (Настройки по умолчанию)
*   `paths.js` (Управление путями)

**Ключевые возможности:**
*   **Динамическая инициализация**: Метод `Config.init(basePath, jobId)` настраивает все пути в зависимости от контекста запуска (Локально или Dynamic Runner).
*   **Единый интерфейс**: Доступ к настройкам через глобальный объект `Config`.

**Пример использования:**
```javascript
#include "../config/config.js"

// Вместо AppPaths.input или Paths.INPUT_PATH
var jsonPath = Config.paths.JSON_PATH; 

// Вместо DefaultSettings.tolerance
var tolerance = Config.settings.tolerance;
```

### Validator Facade (`src/utils/validator.js`)

Этот файл скрывает за собой модульную систему валидации, расположенную в `src/utils/validation/`.
Он экспортирует объект `Validator` (являющийся ссылкой на `ValidatorCore`), обеспечивая обратную совместимость.

**Структура валидации:**
*   **Core**: `validatorCore.js` — Диспетчер, управляющий процессом проверки.
*   **Base**: `baseValidator.js` — Общие методы (проверка типов, диапазонов).
*   **Modules**: Специфичные валидаторы для каждой операции (`resizeValidator.js`, `moveValidator.js`, etc.).

**Поток валидации:**
`Validator.validateCommand()` -> `ValidatorCore` -> `Operation Validator` (e.g. `ResizeValidator`) -> `BaseValidator`

### Operation Registry Facade (`src/operations/operationRegistry.js`)

Центральный компонент (Facade) для управления операциями. Скрывает детали создания и поиска классов операций.

**Функции:**
*   **Регистрация**: Связывает типы операций (строки) с классами реализации.
*   **Фабрика**: Создает экземпляры операций по запросу (`OperationRegistry.get(type)`).
*   **Интроспекция**: Предоставляет список доступных операций (`OperationRegistry.list()`).

**Поток выполнения:**
`Orchestrator` -> `CommandProcessor` -> `OperationRegistry` -> `Specific Operation` (e.g. `ResizeOperation`)

### Helpers Facade (`src/utils/helpers.js`)

Этот файл группирует вспомогательные утилиты в единый объект `Helpers`.

**Структура:**
*   `Helpers.units`: Методы из `src/utils/modules/unitConverter.js`
*   `Helpers.finder`: Методы из `src/utils/modules/objectFinder.js`
*   `Helpers.paths`: Методы из `src/utils/modules/pathResolver.js`
*   `Helpers.styles`: Методы из `src/utils/modules/styleScaler.js`

**Пример использования:**
```javascript
#include "../utils/helpers.js"

var ptValue = Helpers.units.toPoints(10, 'mm');
var obj = Helpers.finder.findByName('Layer1');
```

## 4. Структура AdobeIllustrator-скрипта

```text
src/
├── config/
│   ├── config.js          # [Facade] Единая точка конфигурации
│   ├── constants.js       # Константы
│   ├── defaultSettings.js # Настройки
│   └── paths.js           # Логика путей
├── core/
│   ├── main.js            # Точка входа приложения
│   ├── orchestrator.js    # Управление очередью выполнения
│   └── commandProcessor.js# Обработка отдельных команд
├── operations/            # Реализация операций (Logic)
│   ├── operationRegistry.js # [Facade] Менеджер операций
│   ├── baseOperation.js   # Базовый класс
│   ├── resizeOperation.js
│   ├── moveOperation.js
│   ├── replaceOperation.js
│   ├── confectionCardOperation.js
│   └── ...
├── schemas/               # JSON Schemas
│   ├── main.schema.json   # Мастер-схема
│   ├── common.json        # Общие определения
│   └── *.schema.json      # Схемы операций
└── utils/
    ├── helpers.js         # [Facade] Библиотека помощников
    ├── validator.js       # [Facade] Точка входа валидации
    ├── logger.js          # Логирование
    ├── errorHandler.js    # Обработка ошибок
    ├── modules/           # Реализация утилит
    │   ├── objectFinder.js
    │   ├── pathResolver.js
    │   ├── styleScaler.js
    │   └── unitConverter.js
    └── validation/        # Модули валидации
        ├── validatorCore.js
        ├── baseValidator.js
        └── ...Validator.js
```

### Расширение функциональности (Adding New Modules)

#### Добавление новой утилиты
Чтобы добавить новую утилиту в проект, следуйте алгоритму, описанному в:
[Руководство по добавлению новых модулей](adding_new_modules.md)

#### Добавление новой операции
1.  **Создать файл**: Создайте `src/operations/myNewOperation.js`.
2.  **Наследовать**: Унаследуйте класс от `BaseOperation` и реализуйте метод `execute(params)`.
    ```javascript
    #include "baseOperation.js"
    // ...
    MyNewOperation.prototype = new BaseOperation();
    MyNewOperation.prototype.execute = function() { ... }
    ```
3.  **Зарегистрировать**: Добавьте `#include "myNewOperation.js"` в `src/operations/operationRegistry.js` и зарегистрируйте класс в методе `initialize`:
    ```javascript
    this.register('myNewType', MyNewOperation);
    ```
4.  **Добавить схему**: Создайте JSON Schema для валидации параметров в `src/schemas/`.

## 5. Взаимодействие компонентов

Поток данных при выполнении задачи:

1.  **Launch**: Скрипт запуска (`launch.js` или `runner.jsx`) определяет `jobId` и корневой путь.
2.  **Config Init**: Вызывается `Config.init(rootPath, jobId)`, настраивая пути к `input/output`.
3.  **Main**: `src/core/main.js` читает JSON файл по пути `Config.paths.JSON_PATH`.
4.  **Validation**: `Validator.validateCommand(json)` проверяет структуру и типы данных.
5.  **Orchestration**: `Orchestrator` перебирает операции и для каждой вызывает `CommandProcessor`.
6.  **Execution**: `CommandProcessor` создает экземпляр операции (через `OperationRegistry`) и выполняет её, используя `Helpers`.
7.  **Result**: Результат сохраняется в AI/PDF, логи пишутся в `Config.paths.LOGS_PATH`.

## 6. Структура команд (JSON Schema)

Для валидации используется модульная система JSON Schema в `src/schemas/`.

*   **`main.schema.json`**: Точка входа.
*   **`common.json`**: Общие типы данных.
*   **`*.schema.json`**: Схемы конкретных операций.

### Принцип работы

1.  **Separation of Concerns**: Каждая операция описана в отдельном файле.
2.  **Reusability**: Общие типы через `$ref`.
3.  **Validation**: Внешняя (n8n) и Внутренняя (`src/utils/validator.js`).
