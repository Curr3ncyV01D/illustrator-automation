/**
 * Константы приложения
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

// Типы операций
var OPERATION_TYPES = {
    RESIZE: 'resize',
    MOVE: 'move',
    REPLACE_OBJECT: 'replaceObject',
    CREATE_CONFECTION_CARD: 'createConfectionCard'
};

// Единицы измерения
var UNITS = {
    MM: 'mm',
    CM: 'cm',
    IN: 'in',
    PT: 'pt',
    PX: 'px'
};

// Действия для операций
var ACTIONS = {
    INCREASE: 'increase',
    DECREASE: 'decrease',
    SET: 'set'
};

// Режимы перемещения
var MOVE_MODES = {
    RELATIVE: 'relative',
    ABSOLUTE: 'absolute'
};

// Коды ошибок
var ERROR_CODES = {
    OBJECT_NOT_FOUND: 'OBJECT_NOT_FOUND',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    INVALID_OBJECT_TYPE: 'INVALID_OBJECT_TYPE',
    INVALID_OPERATION: 'INVALID_OPERATION',
    INVALID_PARAMETERS: 'INVALID_PARAMETERS',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    INVALID_JSON: 'INVALID_JSON',
    DOCUMENT_NOT_OPEN: 'DOCUMENT_NOT_OPEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    EXECUTION_ERROR: 'EXECUTION_ERROR'
};

// Уровни логирования
var LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};

// Этапы выполнения
var STAGES = {
    INIT: 'INIT',
    CONFIG: 'CONFIG',
    JSON: 'JSON',
    VALIDATE: 'VALIDATE',
    DOCUMENT: 'DOCUMENT',
    FINDER: 'FINDER',
    OPERATION: 'OPERATION',
    SAVE: 'SAVE',
    COMPLETE: 'COMPLETE'
};
