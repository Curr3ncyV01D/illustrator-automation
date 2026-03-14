/**
 * Библиотека помощников (Facade)
 * Объединяет все утилиты в единый объект Helpers.
 * Используется ES3 синтаксис.
 */

#include "modules/unitConverter.js"
#include "modules/objectFinder.js"
#include "modules/pathResolver.js"
#include "modules/styleScaler.js"
#include "modules/inspector.js"
#include "logger.js"

var Helpers = {
    /**
     * Анализ структуры документа
     * См. src/utils/modules/inspector.js
     */
    inspector: Inspector,

    /**
     * Система логирования
     * См. src/utils/logger.js
     */
    logger: Logger,

    /**
     * Конвертация единиц измерения
     * См. src/utils/modules/unitConverter.js
     */
    units: UnitConverter,

    /**
     * Поиск объектов в документе
     * См. src/utils/modules/objectFinder.js
     */
    finder: ObjectFinder,

    /**
     * Работа с путями и файлами
     * См. src/utils/modules/pathResolver.js
     */
    paths: PathResolver,

    /**
     * Работа со стилями и масштабированием
     * См. src/utils/modules/styleScaler.js
     */
    styles: StyleScaler
};
