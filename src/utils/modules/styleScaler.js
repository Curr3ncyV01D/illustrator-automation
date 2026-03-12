/**
 * Утилита для масштабирования стилей объектов
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

#include "../logger.js"

var StyleScaler = {
    /**
     * Основной метод: Рекурсивно масштабирует обводку у объекта и всех вложенных элементов
     * @param {PageItem} obj - объект (Group, Path, CompoundPath и т.д.)
     * @param {Number} scale - коэффициент масштабирования
     * @param {Object} options - опции (например, { preserveZeroStroke: true })
     * @returns {Number} количество измененных объектов
     */
    scaleStrokeRecursive: function(obj, scale, options) {
        var processed = 0;
        
        try {
            if (!obj) return 0;
            
            // 1. Обработка Групп (GroupItem)
            if (obj.typename === 'GroupItem') {
                var children = obj.pageItems;
                for (var i = 0; i < children.length; i++) {
                    processed += this.scaleStrokeRecursive(children[i], scale, options);
                }
            }
            // 2. Обработка Составных путей (CompoundPathItem)
            else if (obj.typename === 'CompoundPathItem') {
                // У CompoundPath обводка часто лежит на контейнере, но иногда и внутри
                if (obj.stroked) {
                   if (this.scaleStrokeWidth(obj, scale, options ? options.preserveZeroStroke : false)) {
                       processed++;
                   }
                } else {
                    // Если контейнер без обводки, проверяем внутренности
                    var paths = obj.pathItems;
                    for (var j = 0; j < paths.length; j++) {
                        processed += this.scaleStrokeRecursive(paths[j], scale, options);
                    }
                }
            }
            // 3. Обработка Простых путей (PathItem) и других объектов с strokeWidth
            else if (obj.typename === 'PathItem' || obj.typename === 'TextFrame') {
                // TextFrame тоже может иметь обводку
                if (this.scaleStrokeWidth(obj, scale, options ? options.preserveZeroStroke : false)) {
                    processed++;
                }
            }
            // Обработка символов и других типов при необходимости...
            
        } catch (e) {
            // Используем Logger если он доступен, иначе writeln
            if (typeof Logger !== 'undefined') {
                Logger.error('[StyleScaler] Ошибка в рекурсии: ' + e.message);
            } else {
                $.writeln('[ERROR] StyleScaler recursive: ' + e.message);
            }
        }
        
        return processed;
    },

    /**
     * Масштабировать толщину обводки конкретного объекта
     */
    scaleStrokeWidth: function(obj, scale, preserveZeroStroke) {
        try {
            if (!obj.stroked) return false;
            
            var currentWidth = obj.strokeWidth;
            
            // Если толщина 0 и мы хотим её сохранить
            if (currentWidth === 0 && preserveZeroStroke === true) {
                return false;
            }
            
            if (typeof scale !== 'number' || scale <= 0) return false;
            
            var newWidth = currentWidth * scale;
            
            // Защита от исчезновения линии (минимум 0.001 pt)
            obj.strokeWidth = Math.max(newWidth, 0.001);
            
            return true;
        } catch (e) {
            $.writeln('[ERROR] StyleScaler.scaleStrokeWidth: ' + e.message);
            return false;
        }
    },
    
    /**
     * Масштабировать паттерн пунктирной линии
     */
    scaleDashPattern: function(obj, scale) {
        try {
            if (!obj.dashed) return true;
            
            var dashArray = obj.dashArray;
            if (!dashArray || dashArray.length === 0) return true;
            
            var newDashArray = [];
            for (var i = 0; i < dashArray.length; i++) {
                newDashArray.push(dashArray[i] * scale);
            }
            
            obj.dashArray = newDashArray;
            return true;
        } catch (e) {
            $.writeln('[ERROR] StyleScaler.scaleDashPattern: ' + e.message);
            return false;
        }
    },
    
    // Вспомогательный метод для совместимости
    scaleAll: function(obj, scale, options) {
        var effectiveScale = (typeof scale === 'number') ? scale : ((scale.scaleX + scale.scaleY) / 2);
        return this.scaleStrokeRecursive(obj, effectiveScale, options);
    }
};
