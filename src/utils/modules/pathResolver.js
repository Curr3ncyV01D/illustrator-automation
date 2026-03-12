/**
 * Работа с путями файлов
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */



var PathResolver = {
    /**
     * Проверить существование файла
     * @param {String} filePath - путь к файлу
     * @returns {Boolean} true если файл существует
     */
    fileExists: function(filePath) {
        try {
            var file = new File(filePath);
            return file.exists;
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Проверить существование папки
     * @param {String} folderPath - путь к папке
     * @returns {Boolean} true если папка существует
     */
    folderExists: function(folderPath) {
        try {
            var folder = new Folder(folderPath);
            return folder.exists;
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Создать папку, если она не существует
     * @param {String} folderPath - путь к папке
     * @returns {Boolean} true если папка создана или уже существует
     */
    ensureFolder: function(folderPath) {
        try {
            var folder = new Folder(folderPath);
            if (!folder.exists) {
                folder.create();
                return true;
            }
            return true;
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Создать структуру output папок
     */
    createOutputStructure: function() {
        this.ensureFolder(Config.paths.OUTPUT_PATH);
        this.ensureFolder(Config.paths.LOGS_PATH);
        this.ensureFolder(Config.paths.AI_PATH);
        this.ensureFolder(Config.paths.PDF_PATH);
    },
    
    /**
     * Получить полный путь к файлу шаблона
     * @param {String} fileName - имя файла шаблона
     * @returns {String} полный путь
     */
    getSourceFilePath: function(fileName) {
        // Проверяем, является ли путь абсолютным и существует ли файл
        var file = new File(fileName);
        if (file.exists) {
            return file.fsName;
        }
        return Config.paths.getFilePath(Config.paths.SOURCE_FILES_PATH, fileName);
    },
    
    /**
     * Получить полный путь к JSON файлу команды
     * @param {String} fileName - имя JSON файла
     * @returns {String} полный путь
     */
    getJsonPath: function(fileName) {
        return Config.paths.getFilePath(Config.paths.JSON_PATH, fileName);
    },
    
    /**
     * Получить полный путь для сохранения AI файла
     * @param {String} fileName - имя файла
     * @returns {String} полный путь
     */
    getOutputAIPath: function(fileName) {
        // Убеждаемся, что расширение .ai
        if (fileName.indexOf('.ai') === -1) {
            fileName = fileName + '.ai';
        }
        return Config.paths.getFilePath(Config.paths.AI_PATH, fileName);
    },
    
    /**
     * Получить полный путь для сохранения PDF файла
     * @param {String} fileName - имя файла
     * @returns {String} полный путь
     */
    getOutputPDFPath: function(fileName) {
        // Убеждаемся, что расширение .pdf
        if (fileName.indexOf('.pdf') === -1) {
            fileName = fileName + '.pdf';
        }
        return Config.paths.getFilePath(Config.paths.PDF_PATH, fileName);
    },
    
    /**
     * Получить имя файла без расширения
     * @param {String} filePath - путь к файлу
     * @returns {String} имя файла без расширения
     */
    getFileNameWithoutExtension: function(filePath) {
        var file = new File(filePath);
        var name = file.name;
        var lastDot = name.lastIndexOf('.');
        if (lastDot !== -1) {
            return name.substring(0, lastDot);
        }
        return name;
    }
};
