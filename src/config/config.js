/**
 * Единая точка конфигурации проекта (Facade)
 * Объединяет константы, настройки и пути.
 * Используется ES3 синтаксис.
 */

#include "constants.js"
#include "defaultSettings.js"
#include "paths.js"

var Config = {
    settings: DefaultSettings,
    paths: Paths,

    /**
     * Инициализация конфигурации
     * @param {String} codeRoot - путь к исходному коду (папка src)
     * @param {String} dataRoot - путь к данным (папка exchange)
     * @param {String} jobId - ID текущей задачи
     */
    init: function(codeRoot, dataRoot, jobId) {
        this.paths.initialize(codeRoot, dataRoot, jobId);
    }
};

// Экспорт основных констант через Config для удобства
Config.ERROR_CODES = typeof ERROR_CODES !== 'undefined' ? ERROR_CODES : {};
Config.OPERATION_TYPES = typeof OPERATION_TYPES !== 'undefined' ? OPERATION_TYPES : {};
