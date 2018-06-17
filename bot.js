/*
Главный управляющий файл бота
тут должна быть основная логика работы

телеграм бот должен
знать текущий курc коина
знать баланс текущий и показывать его в баксах и коинах
показывать сколько заработано за вчерашний день в коиах и баксах
показывать скокль заработано за день сегодняшний в коиах и баксах

показывать статус майнеров
запущен ли
текущая скорость
общая скорость
температура


отправлять инфу по запросу
отправлять инфу по расписанию в виде отчетов
отправлять инфу при возникновении инцидентов

*/
/*
задача 1
каждые 10 минут сделать запрос к пулу и забрать все данные
        подзадача
        1 шедулер       (решение  kelektiv/node-cron)
        2 запрос в веб  (реализовано в других проетах)
        3 запись в бд   (возмно взять реализацию из другого проекта или взять то что используетс в warehouse-api)

*/

/*
Задача 2 сбор и хранение данных о текучещм кусе и апи для его запроса из базы
    1 апи вызова для запуска сбора и сохранения данных
    2 апи для внутрнених потрбителей, возвращает текущий курс (последний полученный по расписанию)
*/

/*
задача 3 телеграм воркер
который
    1 реализует ответы на зпросы
    2 реализует инрфейс Отсылки отчета по расписанию
*/

/*Fix to telegramm  */
process.env["NTBA_FIX_319"] = 1;
/*\Fix to telegramm  */
require("dotenv").config();

var CronJob = require("cron").CronJob;
var moment = require("moment");

var WorkerGetDataFromPool = require("./workers/GetDataFromPool");
var GetCurrencyPrise = require("./workers/GetCurrencyPrise");
var TelagramWorker = require("./workers/TelagramWorker");
var GetInternetBalance = require("./workers/GetInternetBalance");
var GetClaymore = require("./workers/GetClaymore");
var APIworker = require("./api");

function Every10min() {
  process.env.myDebug || WorkerGetDataFromPool();
  console.log(
    moment().format("YYYY-MM-DD HH:mm:ss"),
    "запуск служб в интервале 10 минут"
  );
}

function Every1min() {
  process.env.myDebug || GetClaymore();
  process.env.myDebug || GetCurrencyPrise();
  console.log(
    moment().format("YYYY-MM-DD HH:mm:ss"),
    "запуск служб в интервале 1 минуты"
  );
}
function Every1day() {
  process.env.myDebug || GetInternetBalance();
  console.log(
    moment().format("YYYY-MM-DD HH:mm:ss"),
    "запуск служб в интервале 1 день"
  );
}

console.log(moment().format("YYYY-MM-DD HH:mm:ss"), "Bot started");
///////
new CronJob("*/10 * * * *", Every10min, null, true, "Asia/Novosibirsk");
new CronJob("*/1 * * * *", Every1min, null, true, "Asia/Novosibirsk");
new CronJob("0 3 * * *", Every1day, null, true, "Asia/Novosibirsk");
///////
process.env.myDebug && console.log("Started in Debug mode");
TelagramWorker();
APIworker();

//SELECT id FROM poolsdata ORDER BY id DESC LIMIT 1;
