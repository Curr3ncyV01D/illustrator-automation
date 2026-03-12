/**
 * Обработчик ошибок
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

#include "../config/constants.js"

/**
 * Класс ошибки приложения
 * @param {String} code - код ошибки
 * @param {String} message - сообщение об ошибке
 * @param {String} context - контекст ошибки
 */
function AppError(code, message, context) {
    this.code = code || ERROR_CODES.EXECUTION_ERROR;
    this.message = message || 'Unknown error';
    this.context = context || '';
    this.name = 'AppError';
}

AppError.prototype.toString = function() {
    var result = this.name + ': [' + this.code + '] ' + this.message;
    if (this.context) {
        result += ' (Context: ' + this.context + ')';
    }
    return result;
};

/**
 * Маппинг кодов ошибок в человекочитаемые сообщения
 */
var ErrorMessages = {
    OBJECT_NOT_FOUND: 'Объект не найден в документе',
    INVALID_OPERATION: 'Недопустимая операция',
    INVALID_PARAMETERS: 'Недопустимые параметры операции',
    FILE_NOT_FOUND: 'Файл не найден',
    INVALID_JSON: 'Недопустимый формат JSON',
    DOCUMENT_NOT_OPEN: 'Документ не открыт',
    VALIDATION_ERROR: 'Ошибка валидации данных',
    EXECUTION_ERROR: 'Ошибка выполнения операции'
};

/**
 * Получить человекочитаемое сообщение по коду ошибки
 * @param {String} code - код ошибки
 * @returns {String} сообщение
 */
function getErrorMessage(code) {
    return ErrorMessages[code] || 'Неизвестная ошибка';
}

/**
 * Создать объект ошибки
 * @param {String} code - код ошибки
 * @param {String} customMessage - кастомное сообщение (опционально)
 * @param {String} context - контекст ошибки (опционально)
 * @returns {AppError} объект ошибки
 */
function createError(code, customMessage, context) {
    var message = customMessage || getErrorMessage(code);
    return new AppError(code, message, context);
}

/**
 * Корректное завершение работы при ошибке
 * @param {AppError} error - объект ошибки
 * @param {Logger} logger - экземпляр логгера
 */
function gracefulExit(error, logger) {
    if (logger) {
        logger.logError(error, error.context || 'GRACEFUL_EXIT');
        logger.error('Application terminated due to error', STAGES.COMPLETE);
    } else {
        $.writeln('Error: ' + error.toString());
    }
    
    // В ExtendScript нельзя принудительно завершить скрипт,
    // но можно выбросить исключение, чтобы остановить выполнение
    throw error;
}
