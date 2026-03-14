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
 * @param {String} jobId - ID текущей задачи
 * @param {String} [codeRoot] - путь к исходному коду (опционально)
 * @param {String} [dataRoot] - путь к данным (опционально)
 */
function main(jsonFilePath, jobId, codeRoot, dataRoot) {
    var startTime = new Date();
    var doc = null;
    
    try {
        // 1. Инициализация путей и конфигурации
        // Если main вызывается из раннера, Config.init уже был вызван глобально.
        // Однако мы вызываем его еще раз для гарантии правильных путей текущей задачи.
        
        var finalCodeRoot = codeRoot;
        var finalDataRoot = dataRoot;
        
        if (!finalCodeRoot || !finalDataRoot) {
            // Фаллбек вычисление корней, если они не переданы в инъекции
            var scriptFile = new File($.fileName);
            if (scriptFile.parent && scriptFile.parent.parent) {
                finalCodeRoot = scriptFile.parent.parent.fsName;
            }
            if (finalCodeRoot) {
                var projectRoot = new File(finalCodeRoot).parent.fsName;
                finalDataRoot = projectRoot + "/exchange";
            }
        }

        // Инициализируем конфигурацию
        Config.init(finalCodeRoot, finalDataRoot, jobId);
        
        // Инициализация логгера и вывод отладочной информации
        Logger.initialize();
        Logger.info('Инициализация приложения:', STAGES.INIT);
        Logger.info('CODE_ROOT: ' + Config.paths.CODE_ROOT, STAGES.INIT);
        Logger.info('DATA_ROOT: ' + Config.paths.DATA_ROOT, STAGES.INIT);
        
        Helpers.paths.createOutputStructure();
        
        // 2. Чтение JSON файла
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
