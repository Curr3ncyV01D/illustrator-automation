/**
 * Система логирования
 * Используется ES3 синтаксис для совместимости с ExtendScript
 */

var Logger = {
    logFile: null,
    isInitialized: false,
    
    /**
     * Инициализация логгера
     * Создает новый файл лога с timestamp
     */
    initialize: function() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // Проверяем, что Paths инициализирован
            if (!Paths || !Paths.LOGS_PATH) {
                $.writeln('Warning: Paths not initialized, cannot create log file');
                return;
            }
            
            // Создаем папку для логов, если её нет
            var logsFolder = new Folder(Paths.LOGS_PATH);
            if (!logsFolder.exists) {
                var created = logsFolder.create();
                if (!created) {
                    $.writeln('Warning: Could not create logs folder: ' + Paths.LOGS_PATH);
                    return;
                }
            }
            
            // Генерируем имя файла с timestamp
            var timestamp = this.getTimestamp();
            // Заменяем символы, которые недопустимы в имени файла Windows
            timestamp = timestamp.replace(/:/g, '-').replace(/\./g, '-');
            var fileName = 'log_' + timestamp + '.txt';
            var logFilePath = Paths.getFilePath(Paths.LOGS_PATH, fileName);
            
            this.logFile = new File(logFilePath);
            
            // Создаем файл, открывая его в режиме записи
            var opened = this.logFile.open('w');
            if (opened) {
                this.logFile.encoding = 'UTF-8';
                this.logFile.lineFeed = 'Unix';
                this.logFile.writeln('=== Log file created ===');
                this.logFile.close();
                this.isInitialized = true;
                
                // Теперь можем писать в файл
                this.write('Logger initialized', LOG_LEVELS.INFO, STAGES.INIT);
            } else {
                $.writeln('Warning: Could not create log file: ' + logFilePath);
                $.writeln('Logs path: ' + Paths.LOGS_PATH);
            }
        } catch (e) {
            // Если не удалось создать лог-файл, используем консоль
            $.writeln('Warning: Could not initialize logger: ' + e.message);
            if (e.line !== undefined) {
                $.writeln('Line: ' + e.line);
            }
        }
    },
    
    /**
     * Запись сообщения в лог
     * @param {String} message - сообщение
     * @param {String} level - уровень (INFO, WARN, ERROR, DEBUG)
     * @param {String} stage - этап выполнения
     */
    write: function(message, level, stage) {
        if (!level) {
            level = LOG_LEVELS.INFO;
        }
        if (!stage) {
            stage = '';
        }
        
        var timestamp = this.getTimestamp();
        var logMessage = '[' + timestamp + '] [' + level + ']';
        if (stage) {
            logMessage += ' [' + stage + ']';
        }
        logMessage += ' ' + message;
        
        // Вывод в консоль ExtendScript
        $.writeln(logMessage);
        
        // Запись в файл
        if (this.logFile) {
            try {
                // В ExtendScript используем режим 'a' (append) для добавления в конец файла
                // Если файл не существует, режим 'a' создаст его
                var opened = this.logFile.open('a');
                
                if (opened) {
                    this.logFile.encoding = 'UTF-8';
                    this.logFile.lineFeed = 'Unix'; // Используем Unix line endings
                    this.logFile.writeln(logMessage);
                    this.logFile.close();
                } else {
                    // Если режим 'a' не работает, пробуем 'e' (edit)
                    opened = this.logFile.open('e');
                    if (opened) {
                        this.logFile.encoding = 'UTF-8';
                        this.logFile.lineFeed = 'Unix';
                        // Переходим в конец файла
                        this.logFile.seek(0, 2); // 2 = SEEK_END
                        this.logFile.writeln(logMessage);
                        this.logFile.close();
                    } else {
                        $.writeln('Error: Could not open log file for writing. Path: ' + this.logFile.fsName);
                    }
                }
            } catch (e) {
                $.writeln('Error writing to log file: ' + e.message);
                if (e.line !== undefined) {
                    $.writeln('Line: ' + e.line);
                }
            }
        } else {
            // Лог-файл не инициализирован
            $.writeln('Warning: Log file not initialized');
        }
    },
    
    /**
     * Логирование информационного сообщения
     * @param {String} message - сообщение
     * @param {String} stage - этап выполнения (опционально)
     */
    info: function(message, stage) {
        this.write(message, LOG_LEVELS.INFO, stage);
    },
    
    /**
     * Логирование предупреждения
     * @param {String} message - сообщение
     * @param {String} stage - этап выполнения (опционально)
     */
    warn: function(message, stage) {
        this.write(message, LOG_LEVELS.WARN, stage);
    },
    
    /**
     * Логирование ошибки
     * @param {String} message - сообщение
     * @param {String} stage - этап выполнения (опционально)
     */
    error: function(message, stage) {
        this.write(message, LOG_LEVELS.ERROR, stage);
    },
    
    /**
     * Логирование ошибки с деталями
     * @param {Error|String} error - объект ошибки или строка
     * @param {String} context - контекст ошибки
     */
    logError: function(error, context) {
        var message = '';
        if (typeof error === 'string') {
            message = error;
        } else if (error && error.message) {
            message = error.message;
            if (error.line !== undefined) {
                message += ' (line: ' + error.line + ')';
            }
        } else {
            message = 'Unknown error';
        }
        
        if (context) {
            message = '[' + context + '] ' + message;
        }
        
        this.error(message, STAGES.OPERATION);
    },
    
    /**
     * Получить timestamp в формате ISO
     * @returns {String} timestamp
     */
    getTimestamp: function() {
        var now = new Date();
        var year = now.getFullYear();
        var month = this.pad(now.getMonth() + 1, 2);
        var day = this.pad(now.getDate(), 2);
        var hours = this.pad(now.getHours(), 2);
        var minutes = this.pad(now.getMinutes(), 2);
        var seconds = this.pad(now.getSeconds(), 2);
        var milliseconds = this.pad(now.getMilliseconds(), 3);
        
        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '.' + milliseconds + 'Z';
    },
    
    /**
     * Дополнить число нулями слева
     * @param {Number} num - число
     * @param {Number} size - размер строки
     * @returns {String} дополненное число
     */
    pad: function(num, size) {
        var s = String(num);
        while (s.length < size) {
            s = '0' + s;
        }
        return s;
    }
};
