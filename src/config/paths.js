/**
 * Пути к файлам и папкам
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

var Paths = {
    // Базовые пути (будут настроены динамически)
    CODE_ROOT: '',
    DATA_ROOT: '',
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
     * Инициализация путей на основе корня кода и корня данных
     * @param {String} codeRoot - путь к исходному коду (src)
     * @param {String} dataRoot - путь к данным (exchange)
     * @param {String} [jobId] - ID текущей задачи (опционально)
     */
    initialize: function(codeRoot, dataRoot, jobId) {
        this.CODE_ROOT = codeRoot;
        this.DATA_ROOT = dataRoot;

        // Глобальная библиотека (общая для всех задач, лежит в exchange/library)
        this.GLOBAL_LIBRARY_PATH = this.join(this.DATA_ROOT, 'library');

        if (jobId && jobId !== 'default') {
            // Режим Dynamic Runner
            // Пути строятся относительно папки jobs/{jobId} внутри DATA_ROOT (exchange)
            var jobPath = 'jobs/' + jobId;
            var fullJobPath = this.join(this.DATA_ROOT, jobPath);
            
            this.INPUT_PATH = this.join(fullJobPath, 'input');
            this.OUTPUT_PATH = this.join(fullJobPath, 'output');
            this.LOGS_PATH = this.join(this.OUTPUT_PATH, 'logs');
            this.JSON_PATH = this.INPUT_PATH; // JSON лежит прямо в input (commands.json)
            this.SOURCE_FILES_PATH = this.join(this.INPUT_PATH, 'source_files');
            this.LOCAL_COMPONENTS_PATH = this.join(this.INPUT_PATH, 'components');
            
            this.AI_PATH = this.join(this.OUTPUT_PATH, 'ai');
            this.PDF_PATH = this.join(this.OUTPUT_PATH, 'pdf');
        } else {
            // Стандартный режим (Autonomous)
            // Обновленная структура: dev/input, dev/output
            // Здесь BASE_PATH заменен на DATA_ROOT для консистентности
            this.INPUT_PATH = this.join(this.DATA_ROOT, 'input');
            this.OUTPUT_PATH = this.join(this.DATA_ROOT, 'output');
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
