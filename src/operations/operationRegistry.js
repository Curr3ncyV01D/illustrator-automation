/**
 * Реестр операций (Facade)
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Управляет доступными операциями и создает их экземпляры.
 * Скрывает детали реализации создания операций.
 */

#include "../config/config.js"
#include "../utils/errorHandler.js"
#include "baseOperation.js"
#include "resizeOperation.js"
#include "moveOperation.js"
#include "replaceOperation.js"
#include "confectionCardOperation.js"

var OperationRegistry = {
    // Реестр операций: тип операции -> конструктор класса
    operations: {},
    
    /**
     * Инициализация реестра
     * Регистрирует все доступные операции
     */
    initialize: function() {
        // Проверка наличия OPERATION_TYPES в Config
        if (!Config.OPERATION_TYPES) {
            // Fallback если Config.OPERATION_TYPES еще не загружен
            if (typeof OPERATION_TYPES !== 'undefined') {
                Config.OPERATION_TYPES = OPERATION_TYPES;
            } else {
                return; // Критическая ошибка, но пока просто выходим
            }
        }

        this.register(Config.OPERATION_TYPES.RESIZE, ResizeOperation);
        this.register(Config.OPERATION_TYPES.MOVE, MoveOperation);
        this.register(Config.OPERATION_TYPES.REPLACE_OBJECT, ReplaceOperation);
        this.register(Config.OPERATION_TYPES.CREATE_CONFECTION_CARD, ConfectionCardOperation);
    },
    
    /**
     * Регистрация операции
     * @param {String} operationType - тип операции
     * @param {Function} OperationClass - конструктор класса операции
     */
    register: function(operationType, OperationClass) {
        if (operationType && OperationClass) {
            this.operations[operationType] = OperationClass;
        }
    },
    
    /**
     * Получить экземпляр операции по типу
     * @param {String} type - тип операции
     * @param {Document} doc - документ Illustrator
     * @param {PageItem} object - целевой объект
     * @param {Object} params - параметры операции
     * @returns {BaseOperation} экземпляр операции
     * @throws {Error} если тип операции неизвестен
     */
    get: function(type, doc, object, params) {
        var OperationClass = this.operations[type];
        
        if (!OperationClass) {
            var errorMsg = 'Неизвестный тип операции: ' + type;
            // Можно использовать ErrorHandler для логирования, но здесь мы должны выбросить исключение или вернуть ошибку
            // Согласно задаче: "вызывает ErrorHandler с понятным сообщением об ошибке"
            // Но также "Возвращает экземпляр нужной операции". 
            // Если мы не можем вернуть экземпляр, мы должны сообщить об этом.
            
            // Создаем ошибку через ErrorHandler (если он доступен как глобальная функция createError)
            var error = null;
            if (typeof createError === 'function') {
                error = createError(Config.ERROR_CODES.INVALID_OPERATION || 'INVALID_OPERATION', errorMsg, 'OperationRegistry.get');
            } else {
                error = new Error(errorMsg);
            }
            
            throw error;
        }
        
        try {
            return new OperationClass(doc, object, params);
        } catch (e) {
            throw new Error('Ошибка при создании операции ' + type + ': ' + e.message);
        }
    },

    /**
     * Алиас для create (для обратной совместимости)
     */
    create: function(type, doc, object, params) {
        try {
            return this.get(type, doc, object, params);
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Проверить доступность операции
     * @param {String} operationType - тип операции
     * @returns {Boolean} true если операция зарегистрирована
     */
    isAvailable: function(operationType) {
        return !!(this.operations[operationType]);
    },
    
    /**
     * Получить список всех доступных команд
     * @returns {Array} массив типов операций
     */
    list: function() {
        var result = [];
        for (var opType in this.operations) {
            if (this.operations.hasOwnProperty(opType)) {
                result.push(opType);
            }
        }
        return result;
    },

    /**
     * Алиас для getAvailableOperations (для обратной совместимости)
     */
    getAvailableOperations: function() {
        return this.list();
    }
};

// Инициализация при загрузке модуля
OperationRegistry.initialize();