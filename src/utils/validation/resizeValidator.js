/**
 * Валидатор операции Resize
 * Используется ES3 синтаксис
 */

#include "baseValidator.js"

var ResizeValidator = {
    /**
     * Валидация параметров операции Resize
     * @param {Object} parameters - параметры операции
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validate: function(parameters, prefix) {
        var errors = [];
        
        if (!parameters.width && !parameters.height) {
            errors.push(prefix + ': для resize необходимо указать width или height');
        }
        
        if (parameters.width) {
            errors = errors.concat(BaseValidator.validateSizeParameter(parameters.width, 'width', prefix));
        }
        
        if (parameters.height) {
            errors = errors.concat(BaseValidator.validateSizeParameter(parameters.height, 'height', prefix));
        }
        
        return errors;
    }
};
