/**
 * Валидатор операции ReplaceObject
 * Используется ES3 синтаксис
 */

#include "baseValidator.js"

var ReplaceValidator = {
    /**
     * Валидация параметров операции ReplaceObject
     * @param {Object} parameters - параметры операции
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validate: function(parameters, prefix) {
        var errors = [];
        
        // Обязательные поля
        if (!parameters.libraryFile) {
            errors.push(prefix + ': для replaceObject необходимо указать libraryFile');
        } else if (typeof parameters.libraryFile !== 'string') {
            errors.push(prefix + ': libraryFile должен быть строкой');
        }
        
        if (!parameters.sourceObject) {
            errors.push(prefix + ': для replaceObject необходимо указать sourceObject');
        } else if (typeof parameters.sourceObject !== 'string') {
            errors.push(prefix + ': sourceObject должен быть строкой');
        }
        
        // Опциональные поля
        if (parameters.matchTargetSize !== undefined && typeof parameters.matchTargetSize !== 'boolean') {
            errors.push(prefix + ': matchTargetSize должен быть true или false');
        }
        
        if (parameters.keepPosition !== undefined && typeof parameters.keepPosition !== 'boolean') {
            errors.push(prefix + ': keepPosition должен быть true или false');
        }
        
        if (parameters.replaceContents !== undefined && typeof parameters.replaceContents !== 'boolean') {
            errors.push(prefix + ': replaceContents должен быть true или false');
        }
        
        // Поддержка старого параметра для совместимости
        if (parameters.scaleStroke !== undefined && typeof parameters.scaleStroke !== 'boolean') {
            errors.push(prefix + ': scaleStroke должен быть true или false');
        }
        
        return errors;
    }
};
