/**
 * Операция создания конфекционной карты
 * Создает новый артборд с таблицей спецификации на основе JSON данных
 */

#include "baseOperation.js"

/**
 * Класс операции создания конфекционной карты
 * @param {Document} doc - документ Illustrator
 * @param {PageItem} object - не используется (null)
 * @param {Object} params - параметры операции (должны содержать массив data)
 */
function ConfectionCardOperation(doc, object, params) {
    // Вызываем конструктор родителя
    BaseOperation.call(this, doc, object, params);
}

// Наследование от BaseOperation
ConfectionCardOperation.prototype = new BaseOperation();
ConfectionCardOperation.prototype.constructor = ConfectionCardOperation;

// Простой полифилл для JSON, если его нет
if (typeof JSON !== 'object') {
    JSON = {};
}
if (!JSON.parse) {
    JSON.parse = function(str) {
        // Простая и небезопасная реализация через eval, как просили в тех. требованиях
        // для ExtendScript
        return eval('(' + str + ')');
    };
}

/**
 * Переопределение валидации
 * @returns {Boolean} true если параметры валидны
 */
ConfectionCardOperation.prototype.validate = function() {
    if (!this.doc) {
        this.error = createError(ERROR_CODES.DOCUMENT_NOT_OPEN, 'Документ не открыт', this.constructor.name);
        return false;
    }

    if (!this.params || !this.params.data) {
        this.error = createError(ERROR_CODES.INVALID_PARAMETERS, 'Отсутствуют данные для таблицы (params.data)', this.constructor.name);
        return false;
    }
    
    return true;
};

/**
 * Выполнение операции
 * @returns {Boolean} true если операция выполнена успешно
 */
ConfectionCardOperation.prototype.execute = function() {
    try {
        var styleName = this.params.layout || "classic";
        var styles = Config.settings.confectionCardStyles || {};
        var style = styles[styleName] || styles["classic"] || { headerColor: [180, 210, 235], rowHeight: 25, showBorders: true, fontSize: 10 };

        this.createConfectionCard(this.params.data, style);
        this.setResult({
            success: true,
            message: "Confection card created successfully"
        });
        return true;
    } catch (e) {
        this.error = createError(ERROR_CODES.EXECUTION_ERROR, 'Ошибка создания карты: ' + e.message, this.constructor.name);
        return false;
    }
};

/**
 * Главная точка входа для создания карты
 * @param {Array} data - массив данных для таблицы
 * @param {Object} style - стиль таблицы
 */
ConfectionCardOperation.prototype.createConfectionCard = function(data, style) {
    // Размеры A4 в пунктах
    var A4_WIDTH = 595.28;
    var A4_HEIGHT = 841.89;
    
    // Настройки таблицы
    var START_X = 20; // Отступ слева на артборде
    var START_Y = -20; // Отступ сверху (в локальных координатах артборда, Y вниз = минус, если 0,0 вверху)
    // НО: В Illustrator Y растет вверх.
    // Если мы создаем артборд [x, y, x+w, y-h], то левый верхний угол - это (x, y).
    // Будем считать координаты относительно левого верхнего угла артборда.
    
    var COL_WIDTHS = [180, 80, 100, 100]; // Pattern Name, Sort Order, Qty. Pattern Pie, Qty. Cut Pieces
    var ROW_HEIGHT = style.rowHeight;
    var HEADER_COLOR = new RGBColor();
    HEADER_COLOR.red = style.headerColor[0];
    HEADER_COLOR.green = style.headerColor[1];
    HEADER_COLOR.blue = style.headerColor[2];
    
    var STROKE_COLOR = new RGBColor();
    STROKE_COLOR.red = 0;
    STROKE_COLOR.green = 0;
    STROKE_COLOR.blue = 0; // Черный
    
    var LINK_COLOR = new RGBColor(); // Синий для ссылок
    LINK_COLOR.red = 0;
    LINK_COLOR.green = 0;
    LINK_COLOR.blue = 255;
    
    var TEXT_COLOR = new RGBColor(); // Обычный черный текст
    TEXT_COLOR.red = 0;
    TEXT_COLOR.green = 0;
    TEXT_COLOR.blue = 0;
    TEXT_COLOR.blue = 0;

    // 1. Определяем позицию нового артборда
    var nextPos = this.getNextArtboardPos();
    var artboardLeft = nextPos.x;
    var artboardTop = nextPos.y;
    
    // Создаем первый артборд
    var currentArtboard = this.doc.artboards.add([artboardLeft, artboardTop, artboardLeft + A4_WIDTH, artboardTop - A4_HEIGHT]);
    var currentY = artboardTop - 50; // Отступ сверху 50pt
    
    // Отрисовка шапки
    this.drawTableHeader(artboardLeft + 20, currentY, COL_WIDTHS, HEADER_COLOR, STROKE_COLOR, style);
    currentY -= ROW_HEIGHT;
    
    var rowsOnPage = 0;
    var MAX_ROWS = 25;
    
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        
        // Проверка на многостраничность
        if (rowsOnPage >= MAX_ROWS) {
            // Создаем новый артборд справа от текущего
            artboardLeft += A4_WIDTH + 20; // Сдвиг на ширину + отступ
            currentArtboard = this.doc.artboards.add([artboardLeft, artboardTop, artboardLeft + A4_WIDTH, artboardTop - A4_HEIGHT]);
            
            currentY = artboardTop - 50;
            this.drawTableHeader(artboardLeft + 20, currentY, COL_WIDTHS, HEADER_COLOR, STROKE_COLOR, style);
            currentY -= ROW_HEIGHT;
            rowsOnPage = 0;
        }
        
        this.drawTableRow(artboardLeft + 20, currentY, item, COL_WIDTHS, ROW_HEIGHT, STROKE_COLOR, TEXT_COLOR, LINK_COLOR, style);
        currentY -= ROW_HEIGHT;
        rowsOnPage++;
    }
};

/**
 * Расчет координат для нового артборда
 * @returns {Object} {x, y} координаты верхнего левого угла
 */
ConfectionCardOperation.prototype.getNextArtboardPos = function() {
    var maxRight = -Infinity;
    var topY = 0;
    
    for (var i = 0; i < this.doc.artboards.length; i++) {
        var rect = this.doc.artboards[i].artboardRect; // [left, top, right, bottom]
        if (rect[2] > maxRight) {
            maxRight = rect[2];
            topY = rect[1]; // Берем Y верхнего края самого правого артборда
        }
    }
    
    // Если артбордов нет (теоретически невозможно при открытом доке), ставим в 0,0
    if (maxRight === -Infinity) return {x: 0, y: 0};
    
    return {x: maxRight + 20, y: topY}; // Отступ 20pt
};

/**
 * Отрисовка шапки таблицы
 */
ConfectionCardOperation.prototype.drawTableHeader = function(startX, startY, colWidths, bgRGB, strokeRGB, style) {
    var headers = ["Pattern Name", "Sort Order", "Qty. Pattern Pie", "Qty. Cut Pieces"];
    var currentX = startX;
    
    for (var i = 0; i < headers.length; i++) {
        var w = colWidths[i];
        var h = style.rowHeight; // Высота шапки
        
        // Рисуем прямоугольник фона
        var rect = this.doc.pathItems.rectangle(startY, currentX, w, h);
        rect.fillColor = bgRGB;
        
        if (style.showBorders) {
            rect.strokeColor = strokeRGB;
            rect.strokeWidth = 0.5;
        } else {
            rect.stroked = false;
        }
        
        // Текст
        var textFrame = this.doc.textFrames.add();
        textFrame.contents = headers[i];
        
        // Стили текста
        var charAttr = textFrame.textRange.characterAttributes;
        charAttr.size = style.fontSize;
        try {
            charAttr.textFont = app.textFonts.getByName("Arial-BoldMT");
        } catch(e) {
            // Если шрифта нет, игнорируем
        }
        
        // Выравнивание (через параграф)
        var paraAttr = textFrame.textRange.paragraphAttributes;
        paraAttr.justification = Justification.CENTER;
        
        // Центрирование по геометрическим границам (по центру ячейки)
        // Горизонтально: начало ячейки + половина свободной ширины
        textFrame.left = currentX + (w - textFrame.width) / 2;
        // Вертикально: верх ячейки - половина свободной высоты
        textFrame.top = startY - (h - textFrame.height) / 2;
        
        currentX += w;
    }
};

/**
 * Отрисовка строки таблицы
 */
ConfectionCardOperation.prototype.drawTableRow = function(startX, startY, rowData, colWidths, rowHeight, strokeRGB, textRGB, linkRGB, style) {
    var values = [
        rowData["name"] || "",
        rowData["sort"] || "",
        rowData["pattern_qty"] || "",
        rowData["cut_qty"] || ""
    ];
    
    var currentX = startX;
    
    for (var i = 0; i < values.length; i++) {
        var w = colWidths[i];
        
        // Рамка
        var rect = this.doc.pathItems.rectangle(startY, currentX, w, rowHeight);
        rect.filled = false;
        
        if (style.showBorders) {
            rect.strokeColor = strokeRGB;
            rect.strokeWidth = 0.5;
        } else {
            rect.stroked = false;
        }
        
        // Текст
        var textFrame = this.doc.textFrames.add();
        textFrame.contents = values[i].toString();
        
        var charAttr = textFrame.textRange.characterAttributes;
        charAttr.size = style.fontSize;
        charAttr.fillColor = textRGB;
        
        // Проверка гиперссылки для первого столбца
        if (i === 0) {
            // Имя паттерна
            // Проверяем наличие объекта
            var itemName = values[i];
            var itemExists = false;
            try {
                this.doc.pageItems.getByName(itemName);
                itemExists = true;
            } catch(e) {
                itemExists = false;
            }
            
            if (itemExists) {
                charAttr.fillColor = linkRGB;
                charAttr.underline = true;
            }
            
            // Выравнивание по левому краю с отступом 5pt
            textFrame.textRange.paragraphAttributes.justification = Justification.LEFT;
            textFrame.left = currentX + 5;
            textFrame.top = startY - (rowHeight - textFrame.height) / 2;
            
        } else {
            // Цифры - по центру
            textFrame.textRange.paragraphAttributes.justification = Justification.CENTER;
            textFrame.left = currentX + (w - textFrame.width) / 2;
            textFrame.top = startY - (rowHeight - textFrame.height) / 2;
        }
        
        currentX += w;
    }
};
