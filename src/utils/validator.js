/**
 * Валидатор JSON команд (Facade)
 * Используется ES3 синтаксис для совместимости с ExtendScript
 * 
 * Этот файл теперь является фасадом для новой модульной системы валидации.
 * Вся логика перенесена в src/utils/validation/
 */

#include "validation/validatorCore.js"

// Экспортируем ValidatorCore как Validator для обратной совместимости
var Validator = ValidatorCore;
