/**
 * Операция замены объектов (поддерживает массовую замену)
 * Uses ES3 syntax for ExtendScript compatibility
 */

#include "baseOperation.js"
#include "../utils/logger.js"

function ReplaceOperation(doc, object, params) {
    BaseOperation.call(this, doc, object, params);
}

ReplaceOperation.prototype = new BaseOperation();
ReplaceOperation.prototype.constructor = ReplaceOperation;

ReplaceOperation.getRegistration = function() {
    return OPERATION_TYPES.REPLACE_OBJECT;
};

ReplaceOperation.prototype.validate = function() {
    // Базовая валидация параметров
    if (!this.params || !this.params.libraryFile || !this.params.sourceObject) {
        this.error = createError(ERROR_CODES.INVALID_PARAMETERS, 'Не указан libraryFile или sourceObject', 'ReplaceOperation.validate');
        return false;
    }
    return true;
};

/**
 * Основной метод выполнения
 */
ReplaceOperation.prototype.execute = function() {
    if (!this.validate()) return false;
    
    var doc = this.doc;
    var params = this.params;
    var sourceDoc = null;
    var originalActiveDoc = app.activeDocument;
    
    try {
        // 2. ПОДГОТОВКА ИСТОЧНИКА (Master Object) - ТЕПЕРЬ ПЕРЕД ЦИКЛОМ
        var libraryFileObj = null;
        var fileName = params.libraryFile;

        // A. Check Local Components
        if (Config.paths.LOCAL_COMPONENTS_PATH) {
            var localFile = new File(Config.paths.LOCAL_COMPONENTS_PATH + '/' + fileName);
            if (localFile.exists) {
                libraryFileObj = localFile;
            }
        }

        // B. Check Global Library
        if (!libraryFileObj && Config.paths.GLOBAL_LIBRARY_PATH) {
            var globalFile = new File(Config.paths.GLOBAL_LIBRARY_PATH + '/' + fileName);
            if (globalFile.exists) {
                libraryFileObj = globalFile;
            }
        }
        
        if (!libraryFileObj) {
             throw new Error('Файл компонента не найден: ' + fileName);
        }
        
        // Небольшая задержка перед открытием, чтобы Illustrator успел "отпустить" файл 
        // после предыдущей операции, если он тот же самый.
        $.sleep(500);

        Logger.info('[REPLACE] Открытие библиотеки: ' + libraryFileObj.fsName);
        sourceDoc = app.open(libraryFileObj);
        var sourceObj = Helpers.finder.findByName(params.sourceObject, sourceDoc);
        
        if (!sourceObj) throw new Error('Объект-источник "' + params.sourceObject + '" не найден в файле: ' + fileName);
        
        Logger.info('[REPLACE] Объект-источник найден. Копирование...');
        
        // Вместо copy/paste используем duplicate напрямую в целевой документ.
        // Это гораздо стабильнее и не использует буфер обмена Windows.
        var masterCopy = sourceObj.duplicate(doc, ElementPlacement.PLACEATEND);
        masterCopy.selected = false;
        
        // Закрываем библиотеку сразу после копирования, чтобы освободить память
        try {
            sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
        } catch (e) {
            Logger.warn('[REPLACE] Не удалось закрыть файл библиотеки: ' + e.message);
        }
        sourceDoc = null;
        
        // Возвращаем фокус на основной документ
        app.activeDocument = doc;

        // 3. ОПРЕДЕЛЕНИЕ ЦЕЛЕЙ (Targets)
        var targets = this._resolveTargets(doc, params);
        
        if (targets.length === 0) {
            var targetDesc = params.target || (this.object && this.object.name) || 'Unnamed Object';
            Logger.warn('[REPLACE] Целевые объекты не найдены для "' + targetDesc + '". Удаление мастер-копии.');
            if (masterCopy) masterCopy.remove();
            return true; 
        }
        
        Logger.info('[REPLACE] Итого объектов для замены: ' + targets.length);
        
        // 4. МАССОВАЯ ЗАМЕНА
        var replacedCount = 0;
        
        for (var i = 0; i < targets.length; i++) {
            var targetObj = targets[i];
            
            // Проверка валидности объекта перед манипуляцией
            if (!targetObj || !targetObj.typename) continue;
            
            // Клонируем мастер-копию для каждого использования
            var newInstance = masterCopy.duplicate(targetObj, ElementPlacement.PLACEBEFORE);
            
            // Позиционирование и Масштабирование
            this._alignAndScale(newInstance, targetObj, params);
            
            // Удаляем старый объект
            try {
                targetObj.remove();
                replacedCount++;
            } catch (err) {
                Logger.warn('[REPLACE] Не удалось удалить целевой объект: ' + err.message);
                if (newInstance) newInstance.remove();
            }
        }
        
        // Удаляем мастер-копию
        if (masterCopy) {
            masterCopy.remove();
        }
        
        this.setResult({
            success: true,
            replacedCount: replacedCount,
            message: 'Заменено объектов: ' + replacedCount
        });
        
        return true;

    } catch (e) {
        if (sourceDoc) sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = originalActiveDoc; // Restore focus
        
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка замены: ' + e.message, 'ReplaceOperation.execute');
        return false;
    }
};

/**
 * Вспомогательный метод: Поиск целевых объектов
 */
ReplaceOperation.prototype._resolveTargets = function(doc, params) {
    var targets = [];
    
    // 1. Используем объект, который уже нашел CommandProcessor (this.object)
    // Либо ищем по params.target, если CommandProcessor ничего не передал
    var input = this.object || params.target;
    
    if (!input) {
        return targets;
    }
    
    // 2. Унификация: приводим входные данные к массиву для единообразной обработки
    var rawItems = [];
    if (Object.prototype.toString.call(input) === '[object Array]') {
        rawItems = input;
    } else {
        rawItems = [input];
    }
    
    // 3. Обработка каждого элемента (имя или объект)
    for (var i = 0; i < rawItems.length; i++) {
        var item = rawItems[i];
        var found = null;
        
        // Если это строка (имя), ищем объект
        if (typeof item === 'string') {
            found = Helpers.finder.findByName(item, doc);
        } else if (item && item.typename) {
            // Если это уже объект (PageItem)
            found = item;
        }
        
        if (found) {
            // 4. Обработка групп (распаковка)
            var shouldReplaceContents = (params.replaceContents === true || params.replaceContents === undefined);

            if (found.typename === 'GroupItem' && shouldReplaceContents) {
                var children = found.pageItems;
                var name = found.name || ('Группа ' + (i+1));
                Logger.info('[REPLACE] Объект "' + name + '" является группой. Найдено ' + children.length + ' элементов для замены внутри группы.');
                
                if (children.length === 0) {
                    Logger.warn('[REPLACE] Группа "' + name + '" пуста.');
                }

                // Добавляем все дочерние элементы группы в итоговый список
                for (var j = 0; j < children.length; j++) {
                    targets.push(children[j]);
                }
            } else {
                // Одиночный объект (PathItem, CompoundPathItem и т.д.)
                targets.push(found);
            }
        } else if (typeof item === 'string') {
            Logger.warn('[REPLACE] Целевой объект по имени "' + item + '" не найден.');
        }
    }
    
    return targets;
};

/**
 * Вспомогательный метод: Выравнивание и Масштабирование
 */
ReplaceOperation.prototype._alignAndScale = function(obj, target, params) {
    var targetBounds = target.geometricBounds; // [left, top, right, bottom]
    var objBounds = obj.geometricBounds;
    
    var targetWidth = Math.abs(targetBounds[2] - targetBounds[0]);
    var targetHeight = Math.abs(targetBounds[1] - targetBounds[3]);
    
    var objWidth = Math.abs(objBounds[2] - objBounds[0]);
    var objHeight = Math.abs(objBounds[1] - objBounds[3]);
    
    // По умолчанию масштабируем (matchTargetSize === true или не указан)
    var shouldScale = (params.matchTargetSize === true || params.matchTargetSize === undefined);
    
    if (shouldScale && objWidth > 0 && objHeight > 0) {
        // Рассчитываем масштаб в процентах
        var scaleX = (targetWidth / objWidth) * 100;
        var scaleY = (targetHeight / objHeight) * 100;
        
        // Параметры для стандартного resize:
        // resize(scaleX, scaleY, changePositions, changeFillPatterns, changeFillGradients, changeStrokePatterns, changeLineWidths)
        var scaleLines = (params.scaleStroke !== false); // по умолчанию true
        
        Logger.info('[REPLACE] Масштабирование объекта: ' + Math.round(scaleX) + '% x ' + Math.round(scaleY) + '%');
        
        // ВАЖНО: Мы НЕ передаем scaleLines в resize(), чтобы избежать двойного масштабирования обводки.
        // Масштабирование обводки будет выполнено рекурсивно ниже через StyleScaler.
        obj.resize(
            scaleX, 
            scaleY, 
            true,  // changePositions
            true,  // changeFillPatterns
            true,  // changeFillGradients
            true,  // changeStrokePatterns
            false  // changeLineWidths (НЕ масштабируем здесь!)
        );
        
        // Применяем рекурсивный StyleScaler для всех объектов
        if (scaleLines) {
            var options = { preserveZeroStroke: true };
            // Для не-равномерного масштабирования используем средний коэффициент
            var scaleFactor = (scaleX + scaleY) / 200;
            if (Helpers.styles && Helpers.styles.scaleStrokeRecursive) {
                Helpers.styles.scaleStrokeRecursive(obj, scaleFactor, options);
            }
        }
    }
    
    // Центрирование (по умолчанию keepPosition === true или не указан)
    var shouldPosition = (params.keepPosition === true || params.keepPosition === undefined);
    
    if (shouldPosition) {
        var currentBounds = obj.geometricBounds;
        var currentCenterX = (currentBounds[0] + currentBounds[2]) / 2;
        var currentCenterY = (currentBounds[1] + currentBounds[3]) / 2;
        
        var targetCenterX = (targetBounds[0] + targetBounds[2]) / 2;
        var targetCenterY = (targetBounds[1] + targetBounds[3]) / 2;
        
        var dx = targetCenterX - currentCenterX;
        var dy = targetCenterY - currentCenterY;
        
        obj.translate(dx, dy);
    }
    
    // Копирование имени (опционально)
    obj.name = target.name;
};
