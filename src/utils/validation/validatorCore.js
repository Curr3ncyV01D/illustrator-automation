/**
 * Ядро валидации
 * Используется ES3 синтаксис
 * 
 * Основная точка входа для валидации команд и операций
 */

#include "../../operations/operationRegistry.js"
#include "baseValidator.js"
#include "resizeValidator.js"
#include "moveValidator.js"
#include "replaceValidator.js"
#include "confectionCardValidator.js"

var ValidatorCore = {
    /**
     * Валидация команды
     * @param {Object} command - объект команды
     * @returns {Object} результат валидации {valid: Boolean, errors: Array}
     */
    validateCommand: function(command) {
        var errors = [];
        
        // Проверка обязательных полей команды
        if (!command.version) {
            errors.push('Отсутствует обязательное поле: version');
        } else if (command.version !== '1.0') {
            errors.push('Неподдерживаемая версия: ' + command.version + ' (поддерживается: 1.0)');
        }
        
        if (!command.targetFile) {
            errors.push('Отсутствует обязательное поле: targetFile');
        } else if (typeof command.targetFile !== 'string') {
            errors.push('Поле targetFile должно быть строкой');
        }
        
        if (!command.operations) {
            errors.push('Отсутствует обязательное поле: operations');
        } else if (Object.prototype.toString.call(command.operations) !== '[object Array]') {
            errors.push('Поле operations должно быть массивом');
        } else if (command.operations.length === 0) {
            errors.push('Массив operations не может быть пустым');
        } else {
            // Валидация каждой операции
            var operationIds = {};
            for (var i = 0; i < command.operations.length; i++) {
                var opErrors = this.validateOperation(command.operations[i], i, operationIds);
                errors = errors.concat(opErrors);
                if (command.operations[i].id) {
                    operationIds[command.operations[i].id] = true;
                }
            }
            
            // Проверка зависимостей
            var depErrors = this.validateDependencies(command.operations, operationIds);
            errors = errors.concat(depErrors);
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Валидация отдельной операции
     * @param {Object} operation - объект операции
     * @param {Number} index - индекс операции
     * @param {Object} existingIds - map существующих ID
     * @returns {Array} массив ошибок
     */
    validateOperation: function(operation, index, existingIds) {
        var errors = [];
        var idx = (index !== undefined) ? (index + 1) : '?';
        var prefix = 'Операция #' + idx;
        
        // Базовая валидация (ID, Type)
        if (!operation.id) {
            errors.push(prefix + ': отсутствует обязательное поле: id');
        } else if (typeof operation.id !== 'string') {
            errors.push(prefix + ': поле id должно быть строкой');
        } else if (existingIds && existingIds[operation.id]) {
            errors.push(prefix + ': дублирующийся ID операции: ' + operation.id);
        }
        
        if (!operation.type) {
            errors.push(prefix + ': отсутствует обязательное поле: type');
            return errors; // Не можем продолжать без типа
        }
        
        // Проверка существования типа операции
        if (!OperationRegistry.isAvailable(operation.type)) {
            errors.push(prefix + ': неизвестный тип операции: ' + operation.type);
            return errors;
        }
        
        // Проверка target (для операций, где это обязательно)
        // TODO: Можно вынести этот список в конфиг операции
        if (operation.type === OPERATION_TYPES.RESIZE || 
            operation.type === OPERATION_TYPES.MOVE || 
            operation.type === OPERATION_TYPES.REPLACE_OBJECT ||
            operation.type === 'color') {
            
            if (!operation.target) {
                errors.push(prefix + ': отсутствует обязательное поле: target');
            } else if (typeof operation.target !== 'string') {
                errors.push(prefix + ': поле target должно быть строкой');
            }
        }
        
        // Валидация параметров
        if (!operation.parameters) {
            errors.push(prefix + ': отсутствует обязательное поле: parameters');
        } else if (typeof operation.parameters !== 'object') {
            errors.push(prefix + ': поле parameters должно быть объектом');
        } else {
            // Делегирование валидации специфичным валидаторам
            var paramErrors = this.dispatchToValidator(operation.type, operation.parameters, prefix);
            errors = errors.concat(paramErrors);
        }
        
        // Валидация dependencies
        if (operation.dependencies !== undefined) {
            if (Object.prototype.toString.call(operation.dependencies) !== '[object Array]') {
                errors.push(prefix + ': поле dependencies должно быть массивом');
            }
        }
        
        return errors;
    },
    
    /**
     * Диспетчер валидации параметров
     * @param {String} type - тип операции
     * @param {Object} parameters - параметры
     * @param {String} prefix - префикс
     * @returns {Array} массив ошибок
     */
    dispatchToValidator: function(type, parameters, prefix) {
        switch (type) {
            case OPERATION_TYPES.RESIZE:
                return ResizeValidator.validate(parameters, prefix);
            case OPERATION_TYPES.MOVE:
                return MoveValidator.validate(parameters, prefix);
            case OPERATION_TYPES.REPLACE_OBJECT:
                return ReplaceValidator.validate(parameters, prefix);
            case OPERATION_TYPES.CREATE_CONFECTION_CARD:
                return ConfectionCardValidator.validate(parameters, prefix);
            default:
                // Для неизвестных типов пока не возвращаем ошибку, если они прошли isAvailable
                // Но лучше вернуть предупреждение или пустой массив
                return [];
        }
    },
    
    /**
     * Валидация зависимостей
     * @param {Array} operations - список операций
     * @param {Object} operationIds - map ID
     * @returns {Array} массив ошибок
     */
    validateDependencies: function(operations, operationIds) {
        var errors = [];
        
        for (var i = 0; i < operations.length; i++) {
            var operation = operations[i];
            if (operation.dependencies && Object.prototype.toString.call(operation.dependencies) === '[object Array]') {
                for (var j = 0; j < operation.dependencies.length; j++) {
                    var depId = operation.dependencies[j];
                    if (!operationIds[depId]) {
                        errors.push('Операция "' + operation.id + '" зависит от несуществующей операции: ' + depId);
                    }
                }
            }
        }
        
        return errors;
    }
};
