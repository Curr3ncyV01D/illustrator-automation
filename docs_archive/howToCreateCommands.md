# 📝 Как составлять JSON команды

## 🔍 Структура команды

Каждая JSON команда состоит из следующих обязательных частей:

```json
{
  "version": "1.0",              // Версия формата (всегда "1.0")
  "targetFile": "template.ai",   // Имя исходного файла из папки input/source_files/
  "operations": [                // Массив операций для выполнения
    {
      "id": "уникальный_id",
      "type": "resize|move",
      "target": "Layer/Object",
      "parameters": { ... },
      "dependencies": []
    }
  ],
  "metadata": {                  // Опциональные метаданные
    "author": "...",
    "description": "..."
  }
}
```

## 📋 Обязательные поля

### **1. version** (строка)
- **Всегда**: `"1.0"`
- Описывает версию формата команды

### **2. targetFile** (строка)
- Имя исходного файла (без пути)
- Файл должен находиться в папке `input/source_files/`
- Пример: `"template.ai"`, `"shirt_template.ai"`

### **3. operations** (массив объектов)
- Массив операций для выполнения
- Минимум 1 операция
- Операции выполняются в порядке, определенном зависимостями

## 🎯 Структура операции

Каждая операция содержит:

```json
{
  "id": "уникальный_идентификатор",  // Уникальный ID для зависимостей
  "type": "resize|move",             // Тип операции
  "target": "Layer/Object",          // Имя объекта (может быть иерархическим)
  "parameters": { ... },             // Параметры операции (зависят от типа)
  "dependencies": []                 // Массив ID операций, которые должны выполниться раньше
}
```

### **target** (строка)
- Имя объекта в документе Illustrator
- Поддерживает иерархический формат: `"LayerName/ObjectName"`
- Примеры:
  - `"Button1"` - объект на верхнем уровне
  - `"FrontLayer/Button1"` - объект Button1 в слое FrontLayer
  - `"Layer1/Group1/Icon"` - вложенные группы

### **dependencies** (массив строк)
- Список ID операций, которые должны выполниться до этой операции
- Если пустой `[]`, операция может выполняться независимо
- Пример: `["resize1", "move1"]` - эта операция выполнится после resize1 и move1

---

## 🔧 Тип операции: **resize** (изменение размеров)
*(См. [resizeOperation.md](resizeOperation.md))*

---

## 🚀 Тип операции: **move** (перемещение)
*(См. [moveOperation.md](moveOperation.md))*

---

## 🔄 Тип операции: **replaceObject** (замена объекта)
*(См. [replaceOperation.md](replaceOperation.md))*

> **Важно:** Все размеры и координаты обрабатываются через `Helpers.units`, передавать значения в командах нужно в **мм**.

---

## 📋 Тип операции: **createConfectionCard** (конфекционная карта)

Используется для создания таблицы спецификации деталей.

### Важные правила для ИИ:
1.  **Язык ключей**: Используй **ТОЛЬКО английские ключи** (`name`, `sort`, `pattern_qty`, `cut_qty`).
2.  **Язык значений**: Значения полей (например, в `name` или `material`) пиши на **языке пользователя** (русский, английский и т.д.).
3.  **Типы данных**: Поля `sort`, `pattern_qty`, `cut_qty` должны быть **числами** (Number), а не строками.

### Параметры:

```json
{
  "operations": [
    {
      "id": "resize1",
      "type": "resize",
      "target": "Button1",
      "parameters": { ... },
      "dependencies": []
    },
    {
      "id": "move1",
      "type": "move",
      "target": "Button1",
      "parameters": { ... },
      "dependencies": ["resize1"]  // Выполнится после resize1
    }
  ]
}
```

**Порядок выполнения:**
1. Сначала выполнится `resize1` (нет зависимостей)
2. Затем выполнится `move1` (зависит от resize1)


### Правила зависимостей:

- `dependencies: []` - операция может выполняться независимо
- ID в dependencies должны существовать в массиве operations
- Нельзя создать циклические зависимости (A зависит от B, B зависит от A)
- Система автоматически определяет порядок выполнения через топологическую сортировку

---

## ✅ Полные примеры

### Пример 1: Простое увеличение размера

```json
{
  "version": "1.0",
  "template": "template.ai",
  "operations": [
    {
      "id": "resize1",
      "type": "resize",
      "target": "Layer1/Button1",
      "parameters": {
        "width": {
          "value": 10,
          "unit": "mm",
          "action": "increase"
        }
      },
      "dependencies": []
    }
  ]
}
```

### Пример 2: Относительное перемещение

```json
{
  "version": "1.0",
  "template": "template.ai",
  "operations": [
    {
      "id": "move1",
      "type": "move",
      "target": "FrontLayer/Icon",
      "parameters": {
        "mode": "relative",
        "x": {
          "value": 15,
          "unit": "mm",
          "action": "increase"
        },
        "y": {
          "value": 5,
          "unit": "mm",
          "action": "decrease"
        }
      },
      "dependencies": []
    }
  ]
}
```

### Пример 3: Комплексная команда с зависимостями

```json
{
  "version": "1.0",
  "template": "shirt_template.ai",
  "operations": [
    {
      "id": "resizeButton",
      "type": "resize",
      "target": "FrontLayer/Button",
      "parameters": {
        "width": {
          "value": 10,
          "unit": "mm",
          "action": "increase"
        },
        "height": {
          "value": 5,
          "unit": "mm",
          "action": "increase"
        }
      },
      "dependencies": []
    },
    {
      "id": "moveButton",
      "type": "move",
      "target": "FrontLayer/Button",
      "parameters": {
        "mode": "relative",
        "x": {
          "value": 5,
          "unit": "mm",
          "action": "increase"
        }
      },
      "dependencies": ["resizeButton"]
    },
    {
      "id": "resizeLogo",
      "type": "resize",
      "target": "BackLayer/Logo",
      "parameters": {
        "width": {
          "value": 20,
          "unit": "mm",
          "action": "set"
        }
      },
      "dependencies": []
    }
  ],
  "metadata": {
    "author": "designer",
    "description": "Изменение размеров кнопки и логотипа"
  }
}
```

**Порядок выполнения:**
1. `resizeButton` и `resizeLogo` выполняются параллельно (нет зависимостей)
2. `moveButton` выполнится после `resizeButton`

---

## 🚨 Частые ошибки

### ❌ Ошибка: Отсутствует обязательное поле
```json
{
  "version": "1.0",
  "operations": [...]  // Отсутствует "template"
}
```

### ❌ Ошибка: Неверный тип операции
```json
{
  "type": "scale"  // Должно быть "resize" или "move"
}
```

### ❌ Ошибка: Неверный action для absolute
```json
{
  "mode": "absolute",
  "x": {
    "action": "increase"  // Для absolute должно быть "set"
  }
}
```

### ❌ Ошибка: Циклическая зависимость
```json
{
  "operations": [
    { "id": "op1", "dependencies": ["op2"] },
    { "id": "op2", "dependencies": ["op1"] }  // Цикл!
  ]
}
```

### ❌ Ошибка: Несуществующая зависимость
```json
{
  "id": "op1",
  "dependencies": ["op999"]  // op999 не существует
}
```

---

## 📌 Советы

1. **Используйте понятные ID**: `"resizeButton1"` лучше, чем `"op1"`
2. **Проверяйте имена объектов**: убедитесь, что объекты существуют в шаблоне
3. **Тестируйте по одной операции**: сначала проверьте простые команды
4. **Используйте метаданные**: поле `metadata` помогает документировать команды
5. **Сохраняйте примеры**: полезно иметь библиотеку типовых команд

---