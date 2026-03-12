/**
 * Базовые функции валидации
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */



var BaseValidator = {
    /**
     * Проверка наличия обязательных полей
     * @param {Object} obj - проверяемый объект
     * @param {Array} fields - список обязательных полей
     * @param {String} prefix - префикс для сообщений об ошибках
     * @returns {Array} массив ошибок
     */
    validateRequiredFields: function(obj, fields, prefix) {
        var errors = [];
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            if (obj[field] === undefined || obj[field] === null) {
                errors.push(prefix + ': отсутствует обязательное поле: ' + field);
            }
        }
        return errors;
    },

    /**
     * Проверка типа значения
     * @param {Any} value - значение
     * @param {String} type - ожидаемый тип ('string', 'number', 'boolean', 'array', 'object')
     * @param {String} fieldName - имя поля
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validateType: function(value, type, fieldName, prefix) {
        var errors = [];
        if (value === undefined || value === null) return errors; // Пропуск, если значение не задано (проверяется в required)

        var isValid = false;
        if (type === 'array') {
            isValid = Object.prototype.toString.call(value) === '[object Array]';
        } else if (type === 'object') {
            isValid = typeof value === 'object' && !((Object.prototype.toString.call(value) === '[object Array]'));
        } else {
            isValid = typeof value === type;
        }

        if (!isValid) {
            errors.push(prefix + ': поле ' + fieldName + ' должно быть типа ' + type + ', получено: ' + typeof value);
        }
        return errors;
    },

    /**
     * Проверка значения по списку допустимых (enum)
     * @param {Any} value - значение
     * @param {Array} allowedValues - список допустимых значений
     * @param {String} fieldName - имя поля
     * @param {String} prefix - префикс
     * @returns {Array} массив ошибок
     */
    validateEnum: function(value, allowedValues, fieldName, prefix) {
        var errors = [];
        if (value === undefined || value === null) return errors;

        var found = false;
        for (var i = 0; i < allowedValues.length; i++) {
            if (value === allowedValues[i]) {
                found = true;
                break;
            }
        }

        if (!found) {
            errors.push(prefix + ': поле ' + fieldName + ' имеет недопустимое значение "' + value + '". Допустимые значения: ' + allowedValues.join(', '));
        }
        return errors;
    },

    /**
     * Валидация параметра размера (width/height)
     * @param {Object} param - параметр размера
     * @param {String} paramName - имя параметра (width/height)
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validateSizeParameter: function(param, paramName, prefix) {
        var errors = [];
        
        // Проверка структуры объекта
        if (typeof param !== 'object') {
            errors.push(prefix + ': ' + paramName + ' должен быть объектом');
            return errors;
        }

        if (typeof param.value !== 'number') {
            errors.push(prefix + ': ' + paramName + '.value должен быть числом');
        }
        
        if (!param.action || (param.action !== ACTIONS.INCREASE && param.action !== ACTIONS.DECREASE && param.action !== ACTIONS.SET)) {
            errors.push(prefix + ': ' + paramName + '.action должен быть: increase, decrease или set');
        }
        
        if (param.unit && !Helpers.units.isValidUnit(param.unit)) {
            errors.push(prefix + ': ' + paramName + '.unit содержит недопустимую единицу измерения: ' + param.unit);
        }
        
        return errors;
    },
    
    /**
     * Валидация параметра координаты (x/y)
     * @param {Object} param - параметр координаты
     * @param {String} paramName - имя параметра (x/y)
     * @param {String} mode - режим перемещения (relative/absolute)
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validateCoordinateParameter: function(param, paramName, mode, prefix) {
        var errors = [];

        // Проверка структуры объекта
        if (typeof param !== 'object') {
            errors.push(prefix + ': ' + paramName + ' должен быть объектом');
            return errors;
        }
        
        if (typeof param.value !== 'number') {
            errors.push(prefix + ': ' + paramName + '.value должен быть числом');
        }
        
        if (!param.action) {
            errors.push(prefix + ': ' + paramName + '.action обязателен');
        } else {
            if (mode === MOVE_MODES.ABSOLUTE && param.action !== ACTIONS.SET) {
                errors.push(prefix + ': для absolute режима ' + paramName + '.action должен быть: set');
            }
            if (mode === MOVE_MODES.RELATIVE && param.action === ACTIONS.SET) {
                errors.push(prefix + ': для relative режима ' + paramName + '.action должен быть: increase или decrease');
            }
        }
        
        if (param.unit && !Helpers.units.isValidUnit(param.unit)) {
            errors.push(prefix + ': ' + paramName + '.unit содержит недопустимую единицу измерения: ' + param.unit);
        }
        
        return errors;
    }
};
