/**
 * Операция изменения размеров объекта
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Наследует BaseOperation
 * Поддерживает width/height изменения с действиями: increase/decrease/set
 * Привязка трансформации от центра
 */

#include "baseOperation.js"

/**
 * Конструктор операции изменения размеров
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - целевой объект
 * @param {Object} params - параметры операции
 */
function ResizeOperation(doc, object, params) {
    BaseOperation.call(this, doc, object, params);
}

ResizeOperation.prototype = new BaseOperation();
ResizeOperation.prototype.constructor = ResizeOperation;

/**
 * Валидация параметров операции
 * @returns {Boolean} true если параметры валидны
 */
ResizeOperation.prototype.validate = function() {
    if (!this.object) {
        this.error = createError(ERROR_CODES.OBJECT_NOT_FOUND, 'Объект не найден', this.constructor.name);
        return false;
    }

    // width/height проверены в JSON валидаторе
    
    return true;
};

/**
 * Выполнение операции
 * @returns {Boolean} true если операция выполнена успешно
 */
ResizeOperation.prototype.execute = function() {
    if (!this.validate()) return false;
    
    try {
        var params = this.params;
        var bounds = this.object.geometricBounds; // [left, top, right, bottom]
        
        var originalWidth = bounds[2] - bounds[0];
        var originalHeight = bounds[1] - bounds[3]; // top - bottom (positive)
        
        var newWidth = originalWidth;
        var newHeight = originalHeight;
        
        // Расчет ширины
        if (params.width) {
            var widthPoints = Helpers.units.toPoints(params.width.value, params.width.unit, this.doc);
            
            if (params.width.action === ACTIONS.SET) {
                newWidth = widthPoints;
            } else if (params.width.action === ACTIONS.INCREASE) {
                newWidth += widthPoints;
            } else if (params.width.action === ACTIONS.DECREASE) {
                newWidth -= widthPoints;
            }
        }
        
        // Расчет высоты
        if (params.height) {
            var heightPoints = Helpers.units.toPoints(params.height.value, params.height.unit, this.doc);
            
            if (params.height.action === ACTIONS.SET) {
                newHeight = heightPoints;
            } else if (params.height.action === ACTIONS.INCREASE) {
                newHeight += heightPoints;
            } else if (params.height.action === ACTIONS.DECREASE) {
                newHeight -= heightPoints;
            }
        }
        
        // Применяем изменение размера
        // scale(scaleX, scaleY, changePositions, fillPatterns, changeFillGradients, changeStrokePattern, changeLineWidths)
        var scaleX = (newWidth / originalWidth) * 100;
        var scaleY = (newHeight / originalHeight) * 100;
        
        this.object.resize(scaleX, scaleY, true, true, true, true, scaleX); // scaleStroke = true (scaleX as approximation)
        
        this.setResult({
            success: true,
            message: 'Object resized to ' + newWidth + 'x' + newHeight
        });
        
        return true;
    } catch (e) {
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка изменения размера: ' + e.message, this.constructor.name);
        return false;
    }
};