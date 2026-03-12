# Руководство разработчика: Добавление новых операций

Это руководство описывает процесс добавления новой функциональности (операции) в проект автоматизации Adobe Illustrator.

## 📁 Структура проекта для разработчика

*   **`src/`** — Основной исходный код ExtendScript.
    *   `core/` — Ядро (Orchestrator, Main).
    *   `operations/` — Логика конкретных операций.
    *   `config/` — Конфигурация и пути.
*   **`dev/`** — Локальные ресурсы для разработки.
    *   `dev/input/` — Положите сюда тестовые файлы `.ai` и JSON.
    *   `dev/output/` — Сюда будут сохранены результаты локальных запусков.
*   **`bridge/`** — Python-сервис (FastAPI) для интеграции.

## Обзор архитектуры

Система работает по принципу диспетчеризации команд:
1.  JSON-команда поступает в `Orchestrator`.
2.  `CommandProcessor` определяет тип операции.
3.  `OperationRegistry` создает экземпляр соответствующего класса.
4.  Вызывается метод `execute()` у экземпляра операции.

Все операции наследуются от базового класса `BaseOperation` и должны реализовывать его интерфейс.

## Пошаговая инструкция

### 1. Объявление типа операции
Откройте файл `src/config/constants.js` и добавьте новый тип в объект `OPERATION_TYPES`.

```javascript
// src/config/constants.js
var OPERATION_TYPES = {
    // ... существующие типы
    ROTATE: 'rotate', // Новый тип
};
```

### 2. Создание класса операции
Создайте новый файл в папке `src/operations/` (например, `rotateOperation.js`).
Используйте следующий шаблон (ES3 Syntax для ExtendScript):

```javascript
// src/operations/rotateOperation.js
#include "../config/constants.js"
#include "baseOperation.js"

/**
 * Операция вращения объекта
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - целевой объект
 * @param {Object} params - параметры { angle: number }
 */
function RotateOperation(doc, object, params) {
    BaseOperation.call(this, doc, object, params);
}

// Наследование
RotateOperation.prototype = new BaseOperation();
RotateOperation.prototype.constructor = RotateOperation;

/**
 * Валидация параметров
 */
RotateOperation.prototype.validate = function() {
    // Вызов родительской валидации (проверка doc и object)
    // Если операция не требует выбранного объекта (как createConfectionCard), 
    // не вызывайте родительский validate, а напишите свой.
    if (!BaseOperation.prototype.validate.call(this)) {
        return false;
    }
    
    // Проверка специфичных параметров
    if (typeof this.params.angle !== 'number') {
        this.error = createError(ERROR_CODES.INVALID_PARAMETERS, 'Не указан угол поворота (angle)', 'RotateOperation');
        return false;
    }
    
    return true;
};

/**
 * Выполнение операции
 */
RotateOperation.prototype.execute = function() {
    if (!this.validate()) return false;
    
    try {
        // Логика операции
        this.object.rotate(this.params.angle);
        
        // Установка результата
        this.setResult({
            success: true,
            message: 'Объект повернут на ' + this.params.angle + ' градусов'
        });
        return true;
        
    } catch (e) {
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, e.message, 'RotateOperation');
        return false;
    }
};
```

### 3. Регистрация операции
Откройте `src/operations/operationRegistry.js` и зарегистрируйте новый класс.

```javascript
// src/operations/operationRegistry.js
// 1. Подключите файл
#include "rotateOperation.js"

// ...

// 2. Добавьте в initialize
initialize: function() {
    // ...
    this.register(OPERATION_TYPES.ROTATE, RotateOperation);
},
```

### 4. Обновление JSON Schema
Чтобы валидатор (и AI) знал о новой операции, обновите `src/schemas/schema.json`.

1.  Добавьте тип в `enum` поля `type`.
2.  Добавьте определение параметров в `definitions`.
3.  Добавьте ссылку в `oneOf`.

```json
// Пример частичного обновления schema.json
"definitions": {
  "rotateParams": {
    "type": "object",
    "required": ["angle"],
    "properties": {
      "angle": { "type": "number" }
    }
  }
}
```

### 5. Обновление AI Manifest
Чтобы нейросеть могла генерировать команды для новой операции, добавьте описание в `docs/ai_manifest.md`.

```markdown
### 5. Вращение (`rotate`)
Поворот объекта на заданный угол.
- **target**: (string) Имя объекта.
- **params**:
  - `angle`: (number) Угол в градусах.
```

## Чек-лист перед коммитом
- [ ] Тип операции добавлен в константы.
- [ ] Класс операции создан и наследуется от BaseOperation.
- [ ] Реализованы методы `validate` и `execute`.
- [ ] Операция зарегистрирована в Registry.
- [ ] Схема JSON обновлена.
- [ ] Манифест AI обновлен.
- [ ] Создан пример использования в `docs/operations.md` (или отдельный файл).
