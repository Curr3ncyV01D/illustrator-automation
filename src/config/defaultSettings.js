/**
 * Настройки по умолчанию
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

var DefaultSettings = {
    // Единицы документа по умолчанию (точки)
    DEFAULT_UNIT: 'pt',
    
    // Точка трансформации (центр)
    TRANSFORM_POINT: 'center',
    
    // Параметры логирования
    LOG_FORMAT: '[TIMESTAMP] [LEVEL] [STAGE] message',
    LOG_ENCODING: 'UTF-8',
    
    // Лимиты значений
    MIN_SIZE: 0.1,  // минимальный размер в мм
    MAX_SIZE: 10000, // максимальный размер в мм
    
    // Коэффициенты конвертации единиц в миллиметры
    UNIT_TO_MM: {
        'mm': 1,
        'cm': 10,
        'in': 25.4,
        'pt': 0.352778, // 1 pt = 0.352778 mm
        'px': 0.264583  // 1 px = 0.264583 mm (при 96 DPI)
    },
    
    // Коэффициенты конвертации миллиметров в единицы
    MM_TO_UNIT: {
        'mm': 1,
        'cm': 0.1,
        'in': 0.0393701,
        'pt': 2.83465,   // 1 mm = 2.83465 pt
        'px': 3.77953    // 1 mm = 3.77953 px (при 96 DPI)
    },
    
    // Расширения файлов
    FILE_EXTENSIONS: {
        AI: '.ai',
        PDF: '.pdf',
        JSON: '.json'
    },
    
    // Настройки сохранения
    SAVE_OPTIONS: {
        saveAICopy: true,
        saveAsPDF: true
    },

    confectionCardStyles: {
        classic: { headerColor: [180, 210, 235], rowHeight: 25, showBorders: true, fontSize: 10 },
        minimal: { headerColor: [255, 255, 255], rowHeight: 20, showBorders: false, fontSize: 8 },
        
        // Стили для разных форматов бумаги (масштабирование ~1.41x)
        classic_a3: { headerColor: [180, 210, 235], rowHeight: 35, showBorders: true, fontSize: 14 },
        classic_a2: { headerColor: [180, 210, 235], rowHeight: 50, showBorders: true, fontSize: 20 },
        classic_a1: { headerColor: [180, 210, 235], rowHeight: 70, showBorders: true, fontSize: 28 },
        classic_a0: { headerColor: [180, 210, 235], rowHeight: 100, showBorders: true, fontSize: 40 },
        
        // Стили без границ для разных форматов
        minimal_a3: { headerColor: [255, 255, 255], rowHeight: 28, showBorders: false, fontSize: 11 },
        minimal_a2: { headerColor: [255, 255, 255], rowHeight: 40, showBorders: false, fontSize: 16 },
        minimal_a1: { headerColor: [255, 255, 255], rowHeight: 56, showBorders: false, fontSize: 22 },
        minimal_a0: { headerColor: [255, 255, 255], rowHeight: 80, showBorders: false, fontSize: 32 }
    },

    SCALE_STYLES: {
        STROKE_WIDTH: true,      // Масштабировать толщину обводки по умолчанию
        DASH_PATTERN: true,      // Масштабировать пунктирные линии
        PRESERVE_ZERO_STROKE: true, // Не изменять нулевую толщину обводки
        MIN_STROKE_WIDTH: 0.01   // Минимальная толщина обводки в точках
    }
};
