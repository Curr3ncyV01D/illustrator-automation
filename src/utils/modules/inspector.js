/**
 * Модуль Inspector для анализа структуры документа Illustrator
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

var Inspector = {
    /**
     * Рекурсивно сканирует документ и собирает информацию об именованных объектах
     * @returns {Object} Иерархическое дерево объектов
     */
    scanDocument: function() {
        if (app.documents.length === 0) return null;
        
        var doc = app.activeDocument;
        var result = {
            name: doc.name,
            type: "Document",
            children: []
        };

        /**
         * Рекурсивный обход слоев
         * @param {Object} parent - Document или Layer
         * @returns {Array} Список дочерних слоев и объектов
         */
        var walkLayers = function(parent) {
            var items = [];

            // 1. Сначала идем по вложенным слоям
            if (parent.layers && parent.layers.length > 0) {
                for (var i = 0; i < parent.layers.length; i++) {
                    var layer = parent.layers[i];
                    items.push({
                        name: layer.name,
                        type: "Layer",
                        children: walkLayers(layer)
                    });
                }
            }

            // 2. Затем идем по PageItems, которые лежат ПРЯМО в этом слое (не в подслоях и не в группах)
            // В Illustrator свойство pageItems содержит ВСЕ объекты, включая вложенные в группы.
            // Но мы хотим только те, у которых parent — это текущий слой.
            if (parent.pageItems && parent.pageItems.length > 0) {
                for (var j = 0; j < parent.pageItems.length; j++) {
                    var item = parent.pageItems[j];
                    
                    if (item.parent === parent) {
                        var node = walkObject(item);
                        if (node) {
                            items.push(node);
                        }
                    }
                }
            }

            return items;
        };

        /**
         * Обработка конкретного объекта (PageItem)
         * @param {Object} item - PageItem
         * @returns {Object|null} Узел дерева или null
         */
        var walkObject = function(item) {
            // Определяем базовый тип
            var type = "Object";
            if (item.typename === "GroupItem") {
                type = "Group";
            } else if (item.typename === "PathItem") {
                type = "Path";
            } else if (item.typename === "TextFrame") {
                type = "Text";
            } else if (item.typename === "CompoundPathItem") {
                type = "CompoundPath";
            } else if (item.typename === "PlacedItem") {
                type = "PlacedItem";
            } else if (item.typename === "RasterItem") {
                type = "Raster";
            }

            var node = {
                name: item.name,
                type: type
            };

            // Если это группа, рекурсивно обходим её содержимое
            if (item.typename === "GroupItem") {
                node.children = [];
                if (item.pageItems && item.pageItems.length > 0) {
                    for (var k = 0; k < item.pageItems.length; k++) {
                        var subItem = item.pageItems[k];
                        // Только прямые потомки группы
                        if (subItem.parent === item) {
                            var subNode = walkObject(subItem);
                            if (subNode) {
                                node.children.push(subNode);
                            }
                        }
                    }
                }
            }

            // Возвращаем объект только если у него есть имя ИЛИ это группа (в которой могут быть именованные объекты)
            // Если нужно сохранять вообще все объекты, уберите проверку item.name !== ""
            if (item.name !== "" || item.typename === "GroupItem") {
                return node;
            }

            // Если группа безымянная, но содержит что-то полезное, мы могли бы вернуть её детей напрямую,
            // но для чистоты структуры "как в панели слоев" лучше следовать иерархии.
            // Если вы хотите видеть даже безымянные группы — верните node.
            
            return null;
        };

        // Начинаем обход с документа (только слои первого уровня)
        result.children = walkLayers(doc);
        return result;
    },

    /**
     * Основная функция запуска инспектора
     * @param {String} [fileName] - Опционально: имя файла. Если не задано, ищет первый .ai в source_files
     */
    run: function(fileName) {
        try {
            // 1. Инициализация путей
            var sourceFilesPath = Config.paths.SOURCE_FILES_PATH;
            var sourceFolder = new Folder(sourceFilesPath);
            var targetFile = null;

            if (fileName) {
                var sourcePath = Helpers.paths.getSourceFilePath(fileName);
                targetFile = new File(sourcePath);
            } else {
                if (!sourceFolder.exists) {
                    throw new Error("Папка source_files не существует: " + sourceFolder.fsName);
                }
                
                var aiFiles = sourceFolder.getFiles("*.ai");
                if (aiFiles.length === 0) {
                    throw new Error("В папке source_files не найдено ни одного .ai файла по пути: " + sourceFolder.fsName);
                }

                targetFile = aiFiles[0];
            }

            if (!targetFile.exists) {
                throw new Error("Чертеж не найден по пути: " + targetFile.fullName);
            }

            if (Helpers && Helpers.logger) {
                Helpers.logger.write("Начало инспекции файла: " + targetFile.name, "INFO", "INSPECTOR");
            }

            // 2. Открытие документа
            var doc = app.open(targetFile);
            
            // 3. Сканирование структуры
            var structure = this.scanDocument();

            // 4. Сохранение результата в output/logs/structure.json
            var logsPath = Config.paths.LOGS_PATH;
            var logsFolder = new Folder(logsPath);
            if (!logsFolder.exists) {
                logsFolder.create();
            }

            var outputFile = new File(logsPath + "/structure.json");
            
            if (outputFile.open("w")) {
                outputFile.encoding = "UTF-8";
                outputFile.write(this._stringify(structure));
                outputFile.close();
                
                if (Helpers && Helpers.logger) {
                    Helpers.logger.write("Структура успешно сохранена в " + outputFile.fsName, "INFO", "INSPECTOR");
                }
            } else {
                throw new Error("Не удалось открыть файл для записи: " + outputFile.fsName);
            }

            // 5. Закрытие документа без сохранения изменений
            doc.close(SaveOptions.DONOTSAVECHANGES);
            
            if (Helpers && Helpers.logger) {
                Helpers.logger.write("Операция Inspector успешно завершена", "INFO", "INSPECTOR");
            }

        } catch (e) {
            var errorMessage = "Критическая ошибка инспекции: " + e.message + (e.line ? " (строка " + e.line + ")" : "");
            
            if (Helpers && Helpers.logger) {
                Helpers.logger.write(errorMessage, "ERROR", "INSPECTOR");
            } else {
                $.writeln(errorMessage);
            }

            // Пытаемся закрыть активный документ в случае ошибки, если он был открыт
            try {
                if (app.documents.length > 0) {
                    app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
                }
            } catch (innerError) {
                // Игнорируем ошибки при закрытии в блоке catch
            }
        }
    },

    /**
     * Простой JSON stringify для ExtendScript (ES3)
     * @private
     */
    _stringify: function(obj, indent) {
        if (!indent) indent = "";
        var nextIndent = indent + "    ";
        var t = typeof (obj);
        
        if (t !== "object" || obj === null) {
            if (t === "string") return '"' + obj.replace(/"/g, '\\"') + '"';
            return String(obj);
        } else {
            var n, v, json = [], arr = (obj && obj.constructor === Array);
            for (n in obj) {
                if (obj.hasOwnProperty(n)) {
                    v = obj[n];
                    t = typeof (v);
                    
                    var key = arr ? "" : '"' + n + '": ';
                    var value = "";
                    
                    if (t === "string") {
                        value = '"' + v.replace(/"/g, '\\"') + '"';
                    } else if (t === "object" && v !== null) {
                        value = this._stringify(v, nextIndent);
                    } else {
                        value = String(v);
                    }
                    
                    json.push(nextIndent + key + value);
                }
            }
            return (arr ? "[\n" : "{\n") + json.join(",\n") + "\n" + indent + (arr ? "]" : "}");
        }
    }
};
