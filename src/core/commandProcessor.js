/**
 * Обработчик команд
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Обрабатывает одну команду: находит объект, создает и выполняет операцию
 */

#include "../config/config.js"
#include "../operations/operationRegistry.js"
#include "../utils/helpers.js"
#include "../utils/logger.js"
#include "../utils/errorHandler.js"
#include "../utils/validator.js"

var CommandProcessor = {
    /**
     * Обработать команду (операцию)
     * @param {Object} command - объект команды (одна операция из массива)
     * @param {Document} doc - документ Illustrator
     * @returns {Object} результат обработки
     */
    process: function(command, doc) {
        try {
            // Валидация операции перед выполнением
            var validationErrors = Validator.validateOperation(command);
            if (validationErrors.length > 0) {
                var valError = createError(ERROR_CODES.VALIDATION_ERROR, 'Ошибка валидации операции: ' + validationErrors.join('; '), 'CommandProcessor.process');
                Logger.error('Ошибка валидации: ' + validationErrors.join('; '), STAGES.OPERATION);
                return {
                    success: false,
                    error: valError,
                    commandId: command.id
                };
            }

            // Поиск целевого объекта
            var targetObject = null;
            
            // Если указан target, ищем его
            if (command.target) {
                // Если target - строка, ищем объект
                if (typeof command.target === 'string') {
                    targetObject = Helpers.finder.findByName(command.target, doc);
                    
                    if (!targetObject) {
                        // Для некоторых операций (например, replaceObject) это может быть не критично,
                        // если они умеют искать сами, но в общем случае это ошибка.
                        // Однако, чтобы позволить операции самой обработать отсутствие объекта, 
                        // мы просто передаем управление дальше, а операция сама решит.
                        Logger.warn('Объект не найден через finder: ' + command.target, STAGES.FINDER);
                    } else {
                        Logger.info('Объект найден: ' + command.target, STAGES.FINDER);
                    }
                } else {
                    // Если target - не строка (например, массив), передаем как есть
                    targetObject = command.target;
                    Logger.info('Целевой объект передан как ' + (typeof command.target), STAGES.FINDER);
                }
            } else {
                // Если target не указан, передаем null.
                // Операции, требующие target (Resize, Move), должны вернуть ошибку валидации.
                // Операции, не требующие target (CreateConfectionCard, ReplaceObject), продолжат работу.
                Logger.info('Целевой объект не указан в команде ' + command.type, STAGES.FINDER);
            }
            
            // Проверка доступности операции
            if (!OperationRegistry.isAvailable(command.type)) {
                var opError = createError(ERROR_CODES.INVALID_OPERATION, 'Неизвестный тип операции: ' + command.type, 'CommandProcessor.process');
                Logger.error('Неизвестный тип операции: ' + command.type, STAGES.OPERATION);
                return {
                    success: false,
                    error: opError,
                    commandId: command.id
                };
            }
            
            // Создание экземпляра операции
            var operation = null;
            try {
                // Добавляем target в параметры, чтобы операция имела к нему доступ
                if (command.target && !command.parameters.target) {
                    command.parameters.target = command.target;
                }
                operation = OperationRegistry.get(command.type, doc, targetObject, command.parameters);
            } catch (e) {
                var createOpError = createError(ERROR_CODES.EXECUTION_ERROR, 'Не удалось создать операцию: ' + e.message, 'CommandProcessor.process');
                Logger.error('Не удалось создать операцию: ' + command.type + '. Ошибка: ' + e.message, STAGES.OPERATION);
                return {
                    success: false,
                    error: createOpError,
                    commandId: command.id
                };
            }
            
            if (!operation) {
                // На случай, если get вернет null (хотя он должен бросать ошибку)
                var createOpError = createError(ERROR_CODES.EXECUTION_ERROR, 'Не удалось создать операцию (null): ' + command.type, 'CommandProcessor.process');
                Logger.error('Не удалось создать операцию: ' + command.type, STAGES.OPERATION);
                return {
                    success: false,
                    error: createOpError,
                    commandId: command.id
                };
            }
            
            Logger.info('Выполнение операции: ' + command.type + ' для объекта: ' + (command.target || 'N/A'), STAGES.OPERATION);
            
            // Выполнение операции
            var executed = false;
            try {
                executed = operation.execute();
            } catch (e) {
                var execError = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка при выполнении операции: ' + e.message, 'CommandProcessor.process');
                Logger.logError(execError, 'CommandProcessor.process');
                return {
                    success: false,
                    error: execError,
                    commandId: command.id
                };
            }
            
            if (!executed) {
                var execError = operation.getError();
                Logger.logError(execError, 'CommandProcessor.process');
                return {
                    success: false,
                    error: execError,
                    commandId: command.id
                };
            }
            
            // Получение результата
            var result = operation.getResult();
            Logger.info('Операция выполнена успешно: ' + command.type, STAGES.OPERATION);
            
            return {
                success: true,
                result: result,
                commandId: command.id,
                commandType: command.type
            };
        } catch (e) {
            var catchError = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка обработки команды: ' + e.message, 'CommandProcessor.process');
            Logger.logError(catchError, 'CommandProcessor.process');
            return {
                success: false,
                error: catchError,
                commandId: command.id
            };
        }
    }
};
