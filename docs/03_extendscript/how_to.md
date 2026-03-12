# Как добавить новую операцию редактирования чертежа

В этом руководстве описан процесс добавления новой функциональности в систему автоматизации Illustrator. Мы пройдем путь от определения констант до реализации логики и регистрации операции.

В качестве примера добавим операцию `RotateOperation`, которая будет поворачивать объект на заданный угол.

***

## Шаг 1: Определение типа операции и констант

Откройте файл *[constants.js](/src/config/constants.js)* и добавьте новый тип операции в объект `OPERATION_TYPES`.

```javascript
// src/config/constants.js
var OPERATION_TYPES = {
    // ... существующие типы
    ROTATE: 'rotate' // Добавьте эту строку
};
```

***

## Шаг 2: Создание JSON-схемы валидации

Создайте новый файл схемы в папке `src/schemas/`. Например, `rotate.schema.json`. Это поможет валидатору проверять корректность входных данных до начала работы скрипта.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Rotate Operation Schema",
  "type": "object",
  "required": ["angle"],
  "properties": {
    "angle": {
      "type": "number",
      "description": "Угол поворота в градусах"
    }
  }
}
```

***

## Шаг 3: Реализация класса операции

Создайте новый файл в папке `src/operations/`, например `rotateOperation.js`. Ваша операция должна наследоваться от `BaseOperation`.

```javascript
// src/operations/rotateOperation.js
#include "baseOperation.js"

/**
 * Операция поворота объекта
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - целевой объект
 * @param {Object} params - параметры (должен содержать angle)
 */
function RotateOperation(doc, object, params) {
    BaseOperation.call(this, doc, object, params);
}

// Наследование
RotateOperation.prototype = new BaseOperation();
RotateOperation.prototype.constructor = RotateOperation;

/**
 * Основная логика операции
 * @returns {Boolean} true если операция выполнена успешно
 */
RotateOperation.prototype.execute = function() {
    // 1. Базовая валидация (наличие объекта и документа)
    if (!this.validate()) return false;
    
    try {
        var angle = this.params.angle;
        
        // 2. Выполнение действия в API Illustrator
        // rotate(angle, changePositions, changeFillPatterns, changeFillGradients, changeStrokePatterns, rotateAbout)
        this.object.rotate(angle, true, true, true, true, Transformation.CENTER);
        
        // 3. Сохранение результата
        this.setResult({
            success: true,
            message: 'Объект повернут на ' + angle + ' градусов'
        });
        
        return true;
    } catch (e) {
        // 4. Обработка ошибок через errorHandler
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка поворота: ' + e.message, 'RotateOperation');
        return false;
    }
};
```

***

## Шаг 4: Регистрация в OperationRegistry

Чтобы система узнала о новой операции, её нужно зарегистрировать в *[operationRegistry.js](/src/operations/operationRegistry.js)*.

1. Подключите файл операции через `#include`.
2. В методе `initialize` добавьте вызов `this.register`.

```javascript
// src/operations/operationRegistry.js
#include "rotateOperation.js" // 1. Подключаем файл

var OperationRegistry = {
    // ...
    initialize: function() {
        // ... существующие регистрации
        this.register(Config.OPERATION_TYPES.ROTATE, RotateOperation); // 2. Регистрируем
    },
    // ...
};
```

***

## Шаг 5: Добавление валидатора (опционально, но рекомендуется)

Для сложной валидации параметров создайте файл в `src/utils/validation/` и подключите его в `validatorCore.js`. Для простых случаев базовая проверка типов в `ValidatorCore` может быть достаточной.

***

## Чек-лист проверки

- [ ] Тип операции добавлен в *[constants.js](/src/config/constants.js)*.
- [ ] Схема создана в *[schemas/](/src/schemas/)*.
- [ ] Класс операции наследует `BaseOperation` и реализует `execute()`.
- [ ] Файл операции подключен и зарегистрирован в *[operationRegistry.js](/src/operations/operationRegistry.js)*.
- [ ] Операция протестирована с валидными и невалидными параметрами.

***

## Использование глобальных Helpers

Внутри классов операций вам доступны глобальные объекты для упрощения типичных задач: конвертации единиц, поиска объектов и логирования.

### Конвертация единиц измерения
Поскольку Illustrator работает в пунктах (`pt`), а команды приходят в миллиметрах (`mm`), используйте `Helpers.units` для перевода значений.

```javascript
// Пример конвертации внутри операции
var widthInPoints = Helpers.units.toPoints(this.params.width.value, this.params.width.unit);
this.object.width = widthInPoints;
```

### Логирование событий
Для записи прогресса и отладки используйте объект `Logger`. Сообщения будут одновременно выводиться в консоль (ESTK/VS Code) и записываться в лог-файл задачи.

```javascript
// Примеры логирования
Logger.info('Начало масштабирования объекта: ' + this.object.name, STAGES.OPERATION);
Logger.warn('Объект имеет заблокированные слои', STAGES.OPERATION);
Logger.error('Критический сбой при изменении размера', STAGES.OPERATION);
```

***

## Модульность JSON-схем

Чтобы не дублировать описание базовых типов (координаты, единицы измерения, структуры действий), используйте общие определения из файла *[common.json](/src/schemas/common.json)* через механизм `$ref`.

### Основные общие определения:
- `unit`: Перечисление поддерживаемых единиц (`mm`, `cm`, `in`, `pt`, `px`).
- `valueWithUnit`: Объект с полями `value` и `unit`.
- `actionValue`: Объект для изменения значений (`set`, `increase`, `decrease`).

### Пример использования в новой схеме:
```json
{
  "properties": {
    "x": {
      "$ref": "common.json#/definitions/valueWithUnit",
      "description": "Координата X"
    },
    "width": {
      "$ref": "common.json#/definitions/actionValue",
      "description": "Параметры ширины"
    }
  }
}
```

***

## Отладка (Debugging)

Разработка на ExtendScript (ES3) имеет свои особенности. Для эффективного поиска ошибок используйте следующие инструменты:

1. **Консольный вывод**: Используйте `$.writeln('Сообщение')` для мгновенного вывода в консоль отладчика. Это быстрее, чем проверка файлов.
2. **Проверка логов**: После завершения работы Bridge (или теста), проверьте папку задачи `exchange/jobs/{job_id}/output/logs/`. Там сохраняется полный лог выполнения с указанием этапов и ошибок.
3. **VS Code Extension**: Рекомендуется установить расширение **"ExtendScript Debugger"** от Adobe. Оно позволяет ставить точки остановки (breakpoints), просматривать значения переменных и пошагово выполнять код прямо из VS Code.
4. **Проверка объектной модели**: Если скрипт ведет себя странно, выведите тип объекта через `Logger.info(this.object.typename)`. Это поможет убедиться, что вы работаете именно с тем элементом, который ожидали (например, `PathItem` vs `GroupItem`).

