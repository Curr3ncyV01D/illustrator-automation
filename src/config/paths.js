/**
 * Пути к файлам и папкам
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

var Paths = {
    // Базовые пути (будут настроены динамически)
    BASE_PATH: '',
    INPUT_PATH: '',
    OUTPUT_PATH: '',
    SOURCE_FILES_PATH: '',
    JSON_PATH: '',
    LOGS_PATH: '',
    AI_PATH: '',
    PDF_PATH: '',
    GLOBAL_LIBRARY_PATH: '',
    LOCAL_COMPONENTS_PATH: '',
    
    /**
     * Инициализация путей на основе базового пути проекта
     * @param {String} basePath - базовый путь к папке проекта
     * @param {String} [jobId] - ID текущей задачи (опционально)
     */
    initialize: function(basePath, jobId) {
        // Если basePath указывает на файл, берем его родительскую папку
        var testFile = new File(basePath);
        if (testFile.exists && !testFile instanceof Folder) {
            var parentFolder = testFile.parent;
            this.BASE_PATH = parentFolder.fsName;
        } else {
            // Если это путь к папке, используем его напрямую
            this.BASE_PATH = basePath;
        }

        // Глобальная библиотека (общая для всех задач)
        this.GLOBAL_LIBRARY_PATH = this.join(this.BASE_PATH, 'exchange/library');

        if (jobId && jobId !== 'default') {
            // Режим Dynamic Runner
            // Пути строятся относительно папки exchange/jobs/{jobId}
            var jobPath = 'exchange/jobs/' + jobId;
            var fullJobPath = this.join(this.BASE_PATH, jobPath);
            
            this.INPUT_PATH = this.join(fullJobPath, 'input');
            this.OUTPUT_PATH = this.join(fullJobPath, 'output');
            this.LOGS_PATH = this.join(this.OUTPUT_PATH, 'logs');
            this.JSON_PATH = this.INPUT_PATH; // JSON лежит прямо в input
            this.SOURCE_FILES_PATH = this.join(this.INPUT_PATH, 'source_files'); // Опционально
            this.LOCAL_COMPONENTS_PATH = this.join(this.INPUT_PATH, 'components');
            
            this.AI_PATH = this.join(this.OUTPUT_PATH, 'ai');
            this.PDF_PATH = this.join(this.OUTPUT_PATH, 'pdf');
        } else {
            // Стандартный режим (Autonomous)
            // Обновленная структура: dev/input, dev/output
            this.INPUT_PATH = this.join(this.BASE_PATH, 'input');
            this.OUTPUT_PATH = this.join(this.BASE_PATH, 'output');
            this.SOURCE_FILES_PATH = this.join(this.INPUT_PATH, 'source_files');
            this.JSON_PATH = this.join(this.INPUT_PATH, 'json');
            this.LOGS_PATH = this.join(this.OUTPUT_PATH, 'logs');
            this.LOCAL_COMPONENTS_PATH = this.join(this.INPUT_PATH, 'components');
            this.AI_PATH = this.join(this.OUTPUT_PATH, 'ai');
            this.PDF_PATH = this.join(this.OUTPUT_PATH, 'pdf');
        }
    },
    
    /**
     * Объединение путей
     * @param {String} base - базовый путь
     * @param {String} relative - относительный путь
     * @returns {String} объединенный путь
     */
    join: function(base, relative) {
        // В ExtendScript используем File для корректной работы с путями
        var baseFile = new Folder(base);
        var resultFile = new Folder(baseFile.fsName + '/' + relative);
        return resultFile.fsName;
    },
    
    /**
     * Получить полный путь к файлу
     * @param {String} folderPath - путь к папке
     * @param {String} fileName - имя файла
     * @returns {String} полный путь
     */
    getFilePath: function(folderPath, fileName) {
        var folder = new Folder(folderPath);
        var file = new File(folder.fsName + '/' + fileName);
        return file.fsName;
    }
};
