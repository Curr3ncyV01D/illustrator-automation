/**
 * Поиск объектов в документе Illustrator по имени
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Поддерживает иерархический поиск вида "LayerName/ObjectName"
 */



var ObjectFinder = {
    /**
     * Найти объект по имени в документе
     * @param {String} name - имя объекта (может быть иерархическим "Layer/Object")
     * @param {Document} doc - документ Illustrator
     * @returns {PageItem|null} найденный объект или null
     */
    findByName: function(name, doc) {
        if (!name || !doc) {
            return null;
        }
        
        // Разделить имя по "/" для иерархического поиска
        var parts = name.split('/');
        var layerName = parts[0];
        var objectName = parts.length > 1 ? parts.slice(1).join('/') : null;
        
        // Если указан только один уровень, ищем объект во всем документе
        if (!objectName) {
            return this.findInDocument(name, doc);
        }
        
        // Иначе ищем слой, затем объект в слое
        var layer = this.findLayer(layerName, doc);
        if (!layer) {
            return null;
        }
        
        return this.findInLayer(objectName, layer);
    },
    
    /**
     * Найти объект в документе (без учета слоев)
     * @param {String} name - имя объекта
     * @param {Document} doc - документ Illustrator
     * @returns {PageItem|null} найденный объект или null
     */
    findInDocument: function(name, doc) {
        try {
            var pageItems = doc.pageItems;
            for (var i = 0; i < pageItems.length; i++) {
                var item = pageItems[i];
                if (item.name === name) {
                    return item;
                }
            }
            
            // Если не найден напрямую, ищем рекурсивно в группах
            for (var j = 0; j < pageItems.length; j++) {
                var pageItem = pageItems[j];
                if (pageItem.typename === 'GroupItem') {
                    var found = this.findInGroup(name, pageItem);
                    if (found) {
                        return found;
                    }
                }
            }
            
            // Если не нашли, логируем доступные объекты
            var itemNames = [];
            for (var k = 0; k < pageItems.length; k++) {
                itemNames.push(pageItems[k].name || ("[" + pageItems[k].typename + "]"));
            }
            Logger.info('Объект "' + name + '" не найден. Доступные объекты: ' + itemNames.join(', '), STAGES.OPERATION);
            
            return null;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Найти слой по имени
     * @param {String} layerName - имя слоя
     * @param {Document} doc - документ Illustrator
     * @returns {Layer|null} найденный слой или null
     */
    findLayer: function(layerName, doc) {
        try {
            var layers = doc.layers;
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].name === layerName) {
                    return layers[i];
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Найти объект в слое
     * @param {String} objectName - имя объекта (может быть иерархическим)
     * @param {Layer} layer - слой
     * @returns {PageItem|null} найденный объект или null
     */
    findInLayer: function(objectName, layer) {
        try {
            var pageItems = layer.pageItems;
            
            // Прямой поиск в слое
            for (var i = 0; i < pageItems.length; i++) {
                if (pageItems[i].name === objectName) {
                    return pageItems[i];
                }
            }
            
            // Рекурсивный поиск в группах
            for (var j = 0; j < pageItems.length; j++) {
                var item = pageItems[j];
                if (item.typename === 'GroupItem') {
                    var found = this.findInGroup(objectName, item);
                    if (found) {
                        return found;
                    }
                }
            }
            
            // Если имя содержит "/", рекурсивно ищем по частям
            if (objectName.indexOf('/') !== -1) {
                var parts = objectName.split('/');
                var groupName = parts[0];
                var nestedName = parts.slice(1).join('/');
                
                // Ищем группу с первым именем
                var group = this.findInLayer(groupName, layer);
                if (group && group.typename === 'GroupItem') {
                    return this.findInGroup(nestedName, group);
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Найти объект в группе рекурсивно
     * @param {String} name - имя объекта
     * @param {GroupItem} group - группа
     * @returns {PageItem|null} найденный объект или null
     */
    findInGroup: function(name, group) {
        try {
            var pageItems = group.pageItems;
            
            // Прямой поиск в группе
            for (var i = 0; i < pageItems.length; i++) {
                if (pageItems[i].name === name) {
                    return pageItems[i];
                }
            }
            
            // Рекурсивный поиск во вложенных группах
            for (var j = 0; j < pageItems.length; j++) {
                var item = pageItems[j];
                if (item.typename === 'GroupItem') {
                    var found = this.findInGroup(name, item);
                    if (found) {
                        return found;
                    }
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    },
    
    /**
     * Проверить существование объекта
     * @param {String} name - имя объекта
     * @param {Document} doc - документ Illustrator
     * @returns {Boolean} true если объект существует
     */
    exists: function(name, doc) {
        return this.findByName(name, doc) !== null;
    }
};
