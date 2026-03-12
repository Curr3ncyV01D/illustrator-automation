# Расширение функциональности (Adding New Modules)

В этом руководстве описан процесс добавления новых утилит в проект с сохранением архитектурной целостности.

Чтобы добавить новую утилиту в проект, следуйте этому алгоритму:

1.  **Создайте файл модуля**:
    Создайте новый `.js` файл в директории `src/utils/modules/`.
    *Пример: `src/utils/modules/colorUtils.js`*

    ```javascript
    // src/utils/modules/colorUtils.js
    var ColorUtils = {
        rgbToHex: function(r, g, b) {
            // логика конвертации
            return "#...";
        }
    };
    ```

2.  **Зарегистрируйте модуль в Facade**:
    Откройте файл `src/utils/helpers.js`.
    
    *   Добавьте `#include` для нового файла в блоке импортов.
    *   Добавьте модуль в объект `Helpers` с понятным ключом.

    ```javascript
    // src/utils/helpers.js
    // ...
    #include "modules/unitConverter.js"
    #include "modules/colorUtils.js" // <--- Добавлено

    var Helpers = {
        units: UnitConverter,
        colors: ColorUtils, // <--- Добавлено
        // ...
    };
    ```

3.  **Используйте в коде**:
    В файлах операций или других частях системы используйте только через фасад `Helpers`:

    ```javascript
    #include "../utils/helpers.js"
    
    // ...
    var hexColor = Helpers.colors.rgbToHex(255, 0, 0);
    ```
