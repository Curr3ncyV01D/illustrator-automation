/**
 * Файл запуска для Production (Autonomous Mode)
 * Автоматически сканирует input/json и обрабатывает первый найденный файл
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

#include "src/config/config.js"
#include "src/core/main.js"

/**
 * Точка входа скрипта
 */
(function() {
    try {
        // Проверка наличия Illustrator
        if (app.name !== 'Adobe Illustrator') {
            $.writeln('Ошибка: Скрипт должен запускаться в Adobe Illustrator');
            return;
        }
        
        // Получаем ID задачи, если он определен (в Dynamic Runner)
        var jobId = (typeof CURRENT_JOB_ID !== 'undefined') ? CURRENT_JOB_ID : 'default';

        // 1. Подавление диалоговых окон для автономной работы
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        
        // 2. Настройка путей
        var scriptFile = new File($.fileName);
        var rootPath = scriptFile.parent.fsName;
        
        // Инициализация конфигурации
        Config.init(rootPath, jobId);
        
        // Если передан jobId, работаем в режиме Dynamic Runner
        if (jobId !== 'default') {
            // В этом режиме мы ожидаем, что путь к JSON файлу будет передан
            // через переменную окружения или вычислен.
            // Но в нашей архитектуре Python генерирует runner.jsx, который вызывает main напрямую.
            // Если же используется launch.js, мы должны найти файл в exchange/jobs/{jobId}/input/commands.json
            
            // Строим путь к JSON файлу
            // При Config.init(rootPath, jobId), Config.paths.JSON_PATH уже указывает на exchange/jobs/{jobId}/input
            var jsonFilePath = Config.paths.JSON_PATH + "/commands.json";
            var jsonFile = new File(jsonFilePath);
            
            if (!jsonFile.exists) {
                $.writeln('Ошибка: JSON файл задачи не найден: ' + jsonFilePath);
                return;
            }
            
            $.writeln('Запуск задачи ' + jobId);
            
            // Запуск главного приложения
            var result = main(jsonFilePath, jobId);
            
            if (result && result.success) {
                $.writeln('Задача выполнена успешно');
            } else {
                $.writeln('Ошибка выполнения задачи');
            }
            
            // Закрываем документ без сохранения (Dynamic Runner Requirement)
            if (app.documents.length > 0) {
                 app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
            }
            
            return;
        }

        // --- Стандартный режим (Autonomous) ---

        var inputJsonDir = new Folder(Config.paths.JSON_PATH);
        var historyDir = new Folder(rootPath + "/dev/input/history");
        
        // Проверяем наличие папки с входными данными
        if (!inputJsonDir.exists) {
            $.writeln('Ошибка: Папка ' + Config.paths.JSON_PATH + ' не найдена');
            return;
        }
        
        // Создаем папку истории, если её нет
        if (!historyDir.exists) {
            historyDir.create();
        }
        
        // 3. Поиск JSON файлов
        var jsonFiles = inputJsonDir.getFiles("*.json");
        
        if (!jsonFiles || jsonFiles.length === 0) {
            $.writeln('Инфо: Новых JSON файлов не найдено');
            return;
        }
        
        // Берем первый найденный файл
        var jsonFile = jsonFiles[0];
        var jsonFilePath = jsonFile.fsName;
        
        $.writeln('Начало обработки файла: ' + jsonFile.name);
        
        // 4. Запуск главного приложения
        var result = main(jsonFilePath);
        
        // 5. Обработка результатов и перемещение файла
        if (result && result.success) {
            $.writeln('Выполнение завершено успешно!');
            $.writeln('Время выполнения: ' + result.executionTime.toFixed(2) + 's');
            
            // Перемещение файла в историю
            var targetFile = new File(historyDir.fsName + "/" + jsonFile.name);
            
            // Если файл с таким именем уже есть в истории, добавляем уникальный суффикс
            if (targetFile.exists) {
                var timestamp = new Date().getTime();
                var nameParts = jsonFile.name.split('.');
                var ext = nameParts.pop();
                var name = nameParts.join('.');
                targetFile = new File(historyDir.fsName + "/" + name + "_" + timestamp + "." + ext);
            }
            
            // Копируем и удаляем (эквивалент перемещения)
            if (jsonFile.copy(targetFile)) {
                jsonFile.remove();
                $.writeln('Файл перемещен в историю: ' + targetFile.name);
            } else {
                $.writeln('Ошибка: Не удалось переместить файл в историю');
            }
            
        } else {
            $.writeln('Выполнение завершилось с ошибкой для файла: ' + jsonFile.name);
            // При ошибке файл остается в input/json для анализа
        }
        
    } catch (e) {
        $.writeln('Критическая ошибка: ' + e.message);
        if (e.line !== undefined) {
            $.writeln('Строка: ' + e.line);
        }
    } finally {
        // Восстанавливаем уровень взаимодействия (на всякий случай, хотя скрипт завершается)
        // app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
        // В продакшене лучше не восстанавливать, если скрипт работает в цикле, 
        // но здесь одиночный запуск. Оставим как есть.
    }
})();
