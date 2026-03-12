/**
 * Главный модуль приложения
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Точка входа приложения
 * Алгоритм:
 * 1. Инициализация: конфиг + логгер
 * 2. Чтение JSON команд
 * 3. Валидация структуры
 * 4. Открытие документа Illustrator
 * 5. Передача команд в оркестратор
 * 6. Сохранение результатов (AI + PDF)
 * 7. Логирование итогов
 * 8. Корректное завершение
 */

#include "../config/config.js"
#include "../utils/logger.js"
#include "../utils/errorHandler.js"
#include "../utils/helpers.js"
#include "../utils/validator.js"
#include "../core/orchestrator.js"

/**
 * Главная функция приложения
 * @param {String} jsonFilePath - путь к JSON файлу команды
 * @param {String} [jobId] - ID текущей задачи (опционально)
 */
function main(jsonFilePath, jobId) {
    var startTime = new Date();
    var doc = null;
    
    try {
        // 1. Инициализация путей и конфигурации
        // Если main вызывается из launch.js, Config.init уже был вызван.
        // Но если main вызывается напрямую (например, из сгенерированного runner.jsx), 
        // нам нужно инициализировать конфиг здесь, если он еще не инициализирован для этого jobId.
        
        // В текущей реализации мы всегда инициализируем Paths.
        // Определяем базовый путь
        var jsonFileObj = new File(jsonFilePath);
        var currentPath = jsonFileObj.parent.fsName;
        var basePath = currentPath;
        
        // Попытка найти корень проекта, если вызов прямой
        // (Логика поиска корня из предыдущей версии main.js)
        var testFolder = new Folder(currentPath);
        var found = false;
        var maxLevels = 10; // Защита от бесконечного цикла
        var level = 0;
        
        while (!found && level < maxLevels) {
            var inputFolder = new Folder(testFolder.fsName + '/dev/input');
            if (inputFolder.exists) {
                basePath = testFolder.fsName;
                found = true;
            } else {
                var stdInputFolder = new Folder(testFolder.fsName + '/input');
                if (stdInputFolder.exists) {
                     basePath = testFolder.fsName;
                     found = true;
                } else {
                    testFolder = testFolder.parent;
                    if (!testFolder || testFolder.fsName === testFolder.parent.fsName) {
                        // Достигли корня или не можем подняться выше
                        break;
                    }
                    level++;
                }
            }
        }
        
        // Если не нашли, используем родительскую папку от JSON файла (для случаев когда JSON в корне проекта)
        if (!found) {
            basePath = jsonFileObj.parent.fsName;
        }
        
        // ВАЖНО: При использовании Dynamic Runner (jobId), basePath может быть переопределен
        // Но сейчас мы полагаемся на то, что jsonFilePath уже содержит нужную структуру
        // Однако, если мы используем jobId, мы хотим, чтобы Paths.initialize построил пути относительно
        // exchange/jobs/{jobId}, поэтому basePath должен быть корневой папкой проекта (где exchange).
        
        // Если передан jobId, мы должны найти корень проекта, а не корень задачи.
        // Корень проекта обычно там, где лежит скрипт main.js (src/core/main.js) -> parent -> parent
        if (jobId && jobId !== 'default') {
             var scriptFile = new File($.fileName);
             if (scriptFile.name === 'launch.js' || scriptFile.name === 'launch_test.js') {
                 basePath = scriptFile.parent.fsName;
             } else {
                 // main.js -> core -> src -> project_root
                 if (scriptFile.parent && scriptFile.parent.parent && scriptFile.parent.parent.parent) {
                     basePath = scriptFile.parent.parent.parent.fsName;
                 }
             }
        }
        
        // Инициализируем конфигурацию
        Config.init(basePath, jobId);
        Helpers.paths.createOutputStructure();
        
        // 2. Инициализация логгера
        Logger.initialize();
        Logger.info('Приложение запущено', STAGES.INIT);
        
        // 3. Чтение JSON файла
        Logger.info('Чтение JSON файла: ' + jsonFilePath, STAGES.JSON);
        var jsonFile = new File(jsonFilePath);
        
        if (!jsonFile.exists) {
            var error = createError(ERROR_CODES.FILE_NOT_FOUND, 'JSON файл не найден: ' + jsonFilePath, 'main');
            Logger.logError(error, 'main');
            gracefulExit(error, Logger);
        }
        
        jsonFile.open('r');
        var jsonContent = jsonFile.read();
        jsonFile.close();
        
        // Парсинг JSON
        // В ExtendScript ES3 нет JSON.parse, используем eval
        var command;
        try {
            // Удаляем BOM и пробелы в начале/конце
            jsonContent = jsonContent.replace(/^\s+|\s+$/g, '');
            if (jsonContent.charCodeAt(0) === 0xFEFF) {
                jsonContent = jsonContent.substring(1);
            }
            // Безопасный eval для парсинга JSON (в ES3 это единственный способ)
            command = eval('(' + jsonContent + ')');
        } catch (e) {
            var jsonError = createError(ERROR_CODES.INVALID_JSON, 'Ошибка парсинга JSON: ' + e.message, 'main');
            Logger.logError(jsonError, 'main');
            gracefulExit(jsonError, Logger);
        }
        
        Logger.info('JSON файл успешно прочитан', STAGES.JSON);
        
        // 4. Валидация команды
        Logger.info('Валидация команды', STAGES.VALIDATE);
        var validation = Validator.validateCommand(command);
        
        if (!validation.valid) {
            var validationError = createError(ERROR_CODES.VALIDATION_ERROR, 'Ошибки валидации: ' + validation.errors.join('; '), 'main');
            Logger.error('Ошибки валидации:', STAGES.VALIDATE);
            for (var v = 0; v < validation.errors.length; v++) {
                Logger.error('  - ' + validation.errors[v], STAGES.VALIDATE);
            }
            gracefulExit(validationError, Logger);
        }
        
        Logger.info('Валидация пройдена успешно', STAGES.VALIDATE);
        
        // 5. Открытие документа Illustrator
        Logger.info('Открытие документа: ' + command.targetFile, STAGES.DOCUMENT);
        var targetFilePath = Helpers.paths.getSourceFilePath(command.targetFile);
        
        if (!Helpers.paths.fileExists(targetFilePath)) {
            var targetFileError = createError(ERROR_CODES.FILE_NOT_FOUND, 'Исходный файл не найден: ' + targetFilePath, 'main');
            Logger.logError(targetFileError, 'main');
            gracefulExit(targetFileError, Logger);
        }
        
        // Открываем документ
        var targetFileObj = new File(targetFilePath);
        
        try {
            doc = app.open(targetFileObj);
        } catch (openError) {
            var openFileError = createError(ERROR_CODES.FILE_NOT_FOUND, 'Ошибка открытия файла: ' + openError.message, 'main');
            Logger.logError(openFileError, 'main');
            gracefulExit(openFileError, Logger);
        }
        
        // Устанавливаем первый артборд как активный
        if (doc.artboards.length > 0) {
            doc.artboards.setActiveArtboardIndex(0);
        }
        
        Logger.info('Документ успешно открыт', STAGES.DOCUMENT);
        
        // 6. Выполнение операций через оркестратор
        Logger.info('Начало выполнения операций', STAGES.OPERATION);
        var executionResult = Orchestrator.execute(command.operations, doc);
        
        if (!executionResult.success) {
            Logger.error('Выполнение операций завершилось с ошибкой', STAGES.OPERATION);
            doc.close(SaveOptions.DONOTSAVECHANGES);
            gracefulExit(executionResult.error, Logger);
        }
        
        Logger.info('Все операции выполнены успешно', STAGES.OPERATION);
        
        // 7. Сохранение результатов
        Logger.info('Сохранение результатов', STAGES.SAVE);
        
        // Генерируем имя файла на основе имени шаблона
        var baseFileName = Helpers.paths.getFileNameWithoutExtension(command.targetFile);
        var timestamp = Logger.getTimestamp().replace(/[:.]/g, '-');
        var outputFileName = baseFileName + '_' + timestamp;
        
        // Сохранение AI файла
        var aiPath = Helpers.paths.getOutputAIPath(outputFileName);
        var aiFile = new File(aiPath);
        var aiSaveOptions = new IllustratorSaveOptions();
        doc.saveAs(aiFile, aiSaveOptions);
        Logger.info('AI файл сохранен: ' + aiPath, STAGES.SAVE);
        
        // Сохранение PDF файла
        var pdfPath = Helpers.paths.getOutputPDFPath(outputFileName);
        var pdfFile = new File(pdfPath);
        var pdfSaveOptions = new PDFSaveOptions();
        doc.saveAs(pdfFile, pdfSaveOptions);
        Logger.info('PDF файл сохранен: ' + pdfPath, STAGES.SAVE);
        
        // 8. Завершение работы
        var endTime = new Date();
        var executionTime = (endTime - startTime) / 1000; // в секундах
        
        Logger.info('Работа завершена успешно. Время выполнения: ' + executionTime.toFixed(2) + 's', STAGES.COMPLETE);
        Logger.info('Операций выполнено: ' + executionResult.results.length, STAGES.COMPLETE);
        
        // Закрываем документ
        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;
        
        return {
            success: true,
            executionTime: executionTime,
            operationsCount: executionResult.results.length,
            aiPath: aiPath,
            pdfPath: pdfPath
        };
        
    } catch (e) {
        // Обработка непредвиденных ошибок
        var unexpectedError = createError(ERROR_CODES.EXECUTION_ERROR, 'Непредвиденная ошибка: ' + e.message, 'main');
        Logger.logError(unexpectedError, 'main');
        
        // Закрываем документ, если он открыт
        if (doc) {
            try {
                doc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (closeError) {
                // Игнорируем ошибки при закрытии
            }
        }
        
        gracefulExit(unexpectedError, Logger);
    }
}
