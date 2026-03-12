/**
 * Валидатор операции Move
 * Используется ES3 синтаксис
 */

#include "baseValidator.js"

var MoveValidator = {
    /**
     * Валидация параметров операции Move
     * @param {Object} parameters - параметры операции
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validate: function(parameters, prefix) {
        var errors = [];
        
        if (!parameters.mode) {
            errors.push(prefix + ': для move необходимо указать mode (relative или absolute)');
        } else if (parameters.mode !== MOVE_MODES.RELATIVE && parameters.mode !== MOVE_MODES.ABSOLUTE) {
            errors.push(prefix + ': mode должен быть "relative" или "absolute"');
        }
        
        if (!parameters.x && !parameters.y) {
            errors.push(prefix + ': для move необходимо указать x или y');
        }
        
        if (parameters.x) {
            errors = errors.concat(BaseValidator.validateCoordinateParameter(parameters.x, 'x', parameters.mode, prefix));
        }
        
        if (parameters.y) {
            errors = errors.concat(BaseValidator.validateCoordinateParameter(parameters.y, 'y', parameters.mode, prefix));
        }
        
        return errors;
    }
};
