/**
 * Операция перемещения объекта
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Наследует BaseOperation
 * Поддерживает два режима:
 * - relative: смещение на dx/dy от текущей позиции
 * - absolute: перемещение в конкретные координаты (от центра)
 */

#include "baseOperation.js"

/**
 * Конструктор операции перемещения
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - целевой объект
 * @param {Object} params - параметры операции
 */
function MoveOperation(doc, object, params) {
    BaseOperation.call(this, doc, object, params);
}

MoveOperation.prototype = new BaseOperation();
MoveOperation.prototype.constructor = MoveOperation;

/**
 * Валидация параметров операции
 * @returns {Boolean} true если параметры валидны
 */
MoveOperation.prototype.validate = function() {
    if (!this.object) {
        this.error = createError(ERROR_CODES.OBJECT_NOT_FOUND, 'Объект не найден', this.constructor.name);
        return false;
    }

    // mode проверен в JSON валидаторе
    // x/y проверены в JSON валидаторе
    
    return true;
};

/**
 * Выполнение операции
 * @returns {Boolean} true если операция выполнена успешно
 */
MoveOperation.prototype.execute = function() {
    if (!this.validate()) return false;
    
    try {
        var params = this.params;
        var mode = params.mode || MOVE_MODES.ABSOLUTE;
        
        // Текущие координаты (от центра)
        // В Illustrator geometricBounds = [left, top, right, bottom]
        // Y ось направлена вверх (в ExtendScript)
        var bounds = this.object.geometricBounds;
        var centerX = (bounds[0] + bounds[2]) / 2;
        var centerY = (bounds[1] + bounds[3]) / 2;
        
        var targetX = centerX;
        var targetY = centerY;
        
        // Расчет X
        if (params.x) {
            var valX = Helpers.units.toPoints(params.x.value, params.x.unit, this.doc);
            
            if (mode === MOVE_MODES.RELATIVE) {
                if (params.x.action === ACTIONS.INCREASE) {
                    targetX += valX;
                } else if (params.x.action === ACTIONS.DECREASE) {
                    targetX -= valX;
                }
            } else {
                // Absolute
                targetX = valX; 
                // Если указана привязка, здесь нужна доработка (пока считаем от центра)
            }
        }
        
        // Расчет Y
        if (params.y) {
            var valY = Helpers.units.toPoints(params.y.value, params.y.unit, this.doc);
            
            if (mode === MOVE_MODES.RELATIVE) {
                // В Illustrator Y+ это вверх.
                // Но обычно пользователи ожидают Y+ вниз (как в веб) или вверх (как в декартовой).
                // Будем следовать стандарту Illustrator: Y+ вверх.
                // Однако, если пользователь хочет "сдвинуть вниз", он может ожидать decrease Y.
                // Тут важно согласовать с requirements.
                // Обычно "Increase Y" = Move Up.
                
                if (params.y.action === ACTIONS.INCREASE) {
                    targetY += valY;
                } else if (params.y.action === ACTIONS.DECREASE) {
                    targetY -= valY;
                }
            } else {
                // Absolute
                // Для абсолютного позиционирования часто имеют в виду координаты относительно артборда
                // В Illustrator начало координат артборда может быть где угодно.
                // Если мы хотим absolute относительно левого верхнего угла артборда:
                
                // Получаем активный артборд
                var artboardIdx = this.doc.artboards.getActiveArtboardIndex();
                var artboard = this.doc.artboards[artboardIdx];
                var abRect = artboard.artboardRect; // [left, top, right, bottom]
                
                // abRect[1] - это TOP. Y уменьшается вниз.
                // Если пользователь задал Y=100 (от верха), то это abRect[1] - 100.
                targetY = abRect[1] - valY;
            }
        }
        
        // Применяем перемещение
        // position = [left, top] - это левый верхний угол объекта!
        // Нам нужно переместить центр в targetX, targetY.
        
        var width = bounds[2] - bounds[0];
        var height = bounds[1] - bounds[3]; // top - bottom (positive)
        
        var newLeft = targetX - (width / 2);
        var newTop = targetY + (height / 2);
        
        this.object.position = [newLeft, newTop];
        
        this.setResult({
            success: true,
            message: 'Object moved to ' + targetX + ', ' + targetY
        });
        
        return true;
    } catch (e) {
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка перемещения: ' + e.message, this.constructor.name);
        return false;
    }
};
