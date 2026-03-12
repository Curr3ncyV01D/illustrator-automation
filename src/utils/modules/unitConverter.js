/**
 * Конвертер единиц измерения
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */


var UnitConverter = {
    /**
     * Конвертировать значение в миллиметры
     * @param {Number} value - значение
     * @param {String} unit - единица измерения (mm, cm, in, pt, px)
     * @returns {Number} значение в миллиметрах
     */
    toMillimeters: function(value, unit) {
        if (!unit || !DefaultSettings.UNIT_TO_MM[unit]) {
            unit = DefaultSettings.DEFAULT_UNIT;
        }
        
        var multiplier = DefaultSettings.UNIT_TO_MM[unit];
        return value * multiplier;
    },
    
    /**
     * Конвертировать значение из миллиметров в указанную единицу
     * @param {Number} valueMM - значение в миллиметрах
     * @param {String} unit - целевая единица измерения
     * @returns {Number} значение в указанной единице
     */
    fromMillimeters: function(valueMM, unit) {
        if (!unit || !DefaultSettings.MM_TO_UNIT[unit]) {
            unit = DefaultSettings.DEFAULT_UNIT;
        }
        
        var multiplier = DefaultSettings.MM_TO_UNIT[unit];
        return valueMM * multiplier;
    },
    
    /**
     * Конвертировать значение в точки (points) с учетом единиц документа
     * @param {Number} value - значение
     * @param {String} unit - единица измерения
     * @param {Document} doc - документ Illustrator (опционально)
     * @returns {Number} значение в точках
     */
    toPoints: function(value, unit, doc) {
        // Сначала конвертируем в миллиметры
        var valueMM = this.toMillimeters(value, unit);
        
        // Затем конвертируем миллиметры в точки
        // 1 мм = 2.83465 точек (фиксированное соотношение)
        return valueMM * DefaultSettings.MM_TO_UNIT[UNITS.PT];
    },
    
    /**
     * Конвертировать значение из точек в указанную единицу
     * @param {Number} valuePoints - значение в точках
     * @param {String} unit - целевая единица измерения
     * @returns {Number} значение в указанной единице
     */
    fromPoints: function(valuePoints, unit) {
        // Сначала конвертируем точки в миллиметры
        var valueMM = valuePoints * DefaultSettings.UNIT_TO_MM[UNITS.PT];
        
        // Затем конвертируем миллиметры в целевую единицу
        return this.fromMillimeters(valueMM, unit);
    },
    
    /**
     * Валидация единицы измерения
     * @param {String} unit - единица измерения
     * @returns {Boolean} true если единица поддерживается
     */
    isValidUnit: function(unit) {
        return !!(unit && DefaultSettings.UNIT_TO_MM[unit]);
    }
};
