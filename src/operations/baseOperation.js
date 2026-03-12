/**
 * Базовый класс для операций
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Все операции наследуются от этого класса
 */

#include "../config/config.js"
#include "../utils/errorHandler.js"
#include "../utils/helpers.js"

/**
 * Базовый класс операции
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - целевой объект
 * @param {Object} params - параметры операции
 */
function BaseOperation(doc, object, params) {
    this.doc = doc;
    this.object = object;
    this.params = params || {};
    this.result = null;
    this.error = null;
}

/**
 * Валидация параметров операции
 * Должен быть переопределен в дочерних классах
 * @returns {Boolean} true если параметры валидны
 */
BaseOperation.prototype.validate = function() {
    // Базовая валидация - проверка наличия объекта
    if (!this.object) {
        this.error = createError(ERROR_CODES.OBJECT_NOT_FOUND, 'Объект не найден', this.constructor.name);
        return false;
    }
    
    if (!this.doc) {
        this.error = createError(ERROR_CODES.DOCUMENT_NOT_OPEN, 'Документ не открыт', this.constructor.name);
        return false;
    }
    
    return true;
};

/**
 * Выполнение операции
 * Должен быть переопределен в дочерних классах
 * @returns {Boolean} true если операция выполнена успешно
 */
BaseOperation.prototype.execute = function() {
    // Должен быть переопределен в дочерних классах
    throw new Error('Метод execute не реализован в ' + this.constructor.name);
};

/**
 * Получить результат выполнения
 * @returns {Object} результат операции
 */
BaseOperation.prototype.getResult = function() {
    return this.result || {
        success: false,
        error: this.error ? this.error.message : 'Unknown error'
    };
};

/**
 * Получить ошибку
 * @returns {AppError|null} объект ошибки или null
 */
BaseOperation.prototype.getError = function() {
    return this.error;
};

/**
 * Установить результат
 * @param {Object} result - результат операции
 */
BaseOperation.prototype.setResult = function(result) {
    this.result = result;
};

/**
 * Проверить успешность выполнения
 * @returns {Boolean} true если операция выполнена успешно
 */
BaseOperation.prototype.isSuccess = function() {
    return this.error === null;
};
