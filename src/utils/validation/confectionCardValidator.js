/**
 * Валидатор операции CreateConfectionCard
 * Используется ES3 синтаксис
 */

#include "baseValidator.js"

var ConfectionCardValidator = {
    /**
     * Валидация параметров операции CreateConfectionCard
     * @param {Object} parameters - параметры операции
     * @param {String} prefix - префикс для сообщений
     * @returns {Array} массив ошибок
     */
    validate: function(parameters, prefix) {
        var errors = [];
        
        if (!parameters.data) {
            errors.push(prefix + ': для createConfectionCard необходимо указать data');
            return errors;
        }
        
        if (Object.prototype.toString.call(parameters.data) !== '[object Array]') {
            errors.push(prefix + ': data должен быть массивом');
            return errors;
        }
        
        if (parameters.data.length === 0) {
            errors.push(prefix + ': data не может быть пустым массивом');
            return errors;
        }
        
        // Валидация элементов массива
        for (var i = 0; i < parameters.data.length; i++) {
            var item = parameters.data[i];
            var itemPrefix = prefix + ': data[' + i + ']';
            
            if (typeof item !== 'object') {
                errors.push(itemPrefix + ' должен быть объектом');
                continue;
            }
            
            if (item.name === undefined) errors.push(itemPrefix + ': отсутствует обязательное поле name');
            if (item.sort === undefined) errors.push(itemPrefix + ': отсутствует обязательное поле sort');
            if (item.pattern_qty === undefined) errors.push(itemPrefix + ': отсутствует обязательное поле pattern_qty');
            if (item.cut_qty === undefined) errors.push(itemPrefix + ': отсутствует обязательное поле cut_qty');
        }
        
        return errors;
    }
};
