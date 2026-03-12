/**
 * Оркестратор выполнения операций
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Управляет последовательностью выполнения операций с учетом зависимостей
 * Гарантирует порядок выполнения согласно dependencies
 */

#include "../config/config.js"
#include "../core/commandProcessor.js"
#include "../utils/logger.js"
#include "../utils/errorHandler.js"

var Orchestrator = {
    /**
     * Выполнить массив операций с учетом зависимостей
     * @param {Array} operations - массив операций
     * @param {Document} doc - документ Illustrator
     * @returns {Object} результат выполнения {success: Boolean, results: Array, errors: Array}
     */
    execute: function(operations, doc) {
        try {
            // Топологическая сортировка для определения порядка выполнения
            var sortedOperations = this.topologicalSort(operations);
            
            if (!sortedOperations.success) {
                return {
                    success: false,
                    error: createError(ERROR_CODES.VALIDATION_ERROR, 'Ошибка сортировки операций: ' + sortedOperations.error, 'Orchestrator.execute'),
                    results: []
                };
            }
            
            var results = [];
            var executionOrder = sortedOperations.order;
            
            Logger.info('Начало выполнения ' + executionOrder.length + ' операций', STAGES.OPERATION);
            
            // Выполнение операций в отсортированном порядке
            for (var i = 0; i < executionOrder.length; i++) {
                var operationIndex = executionOrder[i];
                var operation = operations[operationIndex];
                
                Logger.info('Выполнение операции #' + (i + 1) + ': ' + operation.id + ' (' + operation.type + ')', STAGES.OPERATION);
                
                var result = CommandProcessor.process(operation, doc);
                results.push(result);
                
                // Если операция не выполнена успешно, останавливаем выполнение
                if (!result.success) {
                    Logger.error('Операция завершилась с ошибкой, выполнение остановлено', STAGES.OPERATION);
                    return {
                        success: false,
                        error: result.error,
                        results: results
                    };
                }
            }
            
            Logger.info('Все операции выполнены успешно', STAGES.OPERATION);
            
            return {
                success: true,
                results: results
            };
        } catch (e) {
            var error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка оркестратора: ' + e.message, 'Orchestrator.execute');
            Logger.logError(error, 'Orchestrator.execute');
            return {
                success: false,
                error: error,
                results: []
            };
        }
    },
    
    /**
     * Топологическая сортировка операций с учетом зависимостей
     * Использует алгоритм Кана (Kahn's algorithm)
     * @param {Array} operations - массив операций
     * @returns {Object} результат {success: Boolean, order: Array, error: String}
     */
    topologicalSort: function(operations) {
        try {
            // Создаем карту ID -> индекс операции
            var idToIndex = {};
            for (var i = 0; i < operations.length; i++) {
                if (operations[i].id) {
                    idToIndex[operations[i].id] = i;
                }
            }
            
            // Вычисляем входящие степени (количество зависимостей)
            var inDegree = [];
            var adjacencyList = [];
            
            for (var j = 0; j < operations.length; j++) {
                inDegree[j] = 0;
                adjacencyList[j] = [];
            }
            
            // Строим граф зависимостей
            for (var k = 0; k < operations.length; k++) {
                var operation = operations[k];
                if (operation.dependencies && Object.prototype.toString.call(operation.dependencies) === '[object Array]') {
                    for (var d = 0; d < operation.dependencies.length; d++) {
                        var depId = operation.dependencies[d];
                        var depIndex = idToIndex[depId];
                        
                        if (depIndex === undefined) {
                            return {
                                success: false,
                                error: 'Зависимость не найдена: ' + depId,
                                order: []
                            };
                        }
                        
                        // Добавляем ребро: depIndex -> k (зависимость выполняется до текущей операции)
                        adjacencyList[depIndex].push(k);
                        inDegree[k]++;
                    }
                }
            }
            
            // Находим операции без входящих зависимостей (входящая степень = 0)
            var queue = [];
            for (var m = 0; m < operations.length; m++) {
                if (inDegree[m] === 0) {
                    queue.push(m);
                }
            }
            
            var result = [];
            var processed = 0;
            
            // Обработка операций
            while (queue.length > 0) {
                var current = queue.shift();
                result.push(current);
                processed++;
                
                // Уменьшаем входящую степень всех зависимых операций
                var dependents = adjacencyList[current];
                for (var n = 0; n < dependents.length; n++) {
                    var dependent = dependents[n];
                    inDegree[dependent]--;
                    if (inDegree[dependent] === 0) {
                        queue.push(dependent);
                    }
                }
            }
            
            // Если обработаны не все операции, значит есть цикл
            if (processed !== operations.length) {
                return {
                    success: false,
                    error: 'Обнаружен цикл в зависимостях операций',
                    order: []
                };
            }
            
            return {
                success: true,
                order: result,
                error: null
            };
        } catch (e) {
            return {
                success: false,
                error: 'Ошибка топологической сортировки: ' + e.message,
                order: []
            };
        }
    }
};
