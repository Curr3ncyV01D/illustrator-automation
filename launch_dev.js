/**
 * Файл запуска для тестирования (Development Mode)
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Позволяет вручную выбирать JSON файлы и видеть все диалоговые окна
 */
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

        // Включаем отображение диалоговых окон для отладки
        app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
        
        // Получаем путь к JSON файлу команды вручную
        var jsonFile = File.openDialog('Выберите JSON файл команды', 'JSON Files:*.json');
        
        if (!jsonFile) {
            $.writeln('Отмена: Файл не выбран');
            return;
        }
        
        var jsonFilePath = jsonFile.fsName;
        
        // Запуск главного приложения
        var result = main(jsonFilePath);
        
        if (result && result.success) {
            $.writeln('Выполнение завершено успешно!');
            $.writeln('Время выполнения: ' + result.executionTime.toFixed(2) + 's');
            $.writeln('Операций выполнено: ' + result.operationsCount);
            $.writeln('AI файл: ' + result.aiPath);
            $.writeln('PDF файл: ' + result.pdfPath);
            alert('Готово! Обработано операций: ' + result.operationsCount);
        } else {
            $.writeln('Выполнение завершилось с ошибкой');
            alert('Ошибка выполнения. См. консоль.');
        }
        
    } catch (e) {
        $.writeln('Критическая ошибка: ' + e.message);
        if (e.line !== undefined) {
            $.writeln('Строка: ' + e.line);
        }
        alert('Критическая ошибка: ' + e.message);
    }
})();
