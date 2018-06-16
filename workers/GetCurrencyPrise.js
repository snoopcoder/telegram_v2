const phin = require("phin").promisified;
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");
var get = require("lodash.get");

async function EnumCurr() {
  let q = dedent`
    SELECT id, url,lastmask from currencies`;
  let curr_arr = [];
  try {
    let result = await query(q);
    curr_arr = result;
  } catch (e) {
    console.log("Ошибка получения списка валют", e);
    return 0;
  }
  return curr_arr;
}

async function start() {
  //по  лучить наблюдаемые валюты
  let curr_arr = await EnumCurr();
  if (!curr_arr) return 0;

  for (let item of curr_arr) {
    //получить курс для каждой
    let tiker = await GetPriseFromeWeb(item.url, item.lastmask);
    //записать каждую
    await PutBase(item.id, tiker.ondate, tiker.last);
  }
}

async function PutBase(curr_id, ondate, last) {
  let q = dedent`
  INSERT INTO  currencies_tikers SET
    curr_id=?, 
    ondate=?,
    last=?`;

  try {
    let result = await query(q, [curr_id, ondate, last]);
  } catch (e) {
    console.log("Ошибка записи тикера в базу", e);
    return 0;
  }
}

async function GetPriseFromeWeb(url, lastmask) {
  let tiker = {
    ondate: moment().format("YYYY-MM-DD HH:mm:ss"),
    last: 0
  };
  try {
    res = await phin({
      url: url,
      parse: "json"
    });
  } catch (e) {
    console.log("Error in GetPriseFromeWeb ");
    return 0;
  }

  tiker.last = get(res.body, lastmask);
  return tiker;
}

async function GivePrise(curr_name) {
  //get curr_id by curr name
  let q = dedent`
  SELECT id from currencies WHERE symbol=?`;
  let cirr_id = -1;
  try {
    let result = await query(q, [curr_name]);
    cirr_id = result[0].id;
  } catch (e) {
    console.log("Ошибка получения списка валют", e);
    return 0;
  }

  //get last prise by curr_id
  q = dedent`
  SELECT last from currencies_tikers WHERE curr_id=? ORDER BY id DESC LIMIT 1`;
  let last = 0;
  try {
    let result = await query(q, [cirr_id]);
    last = result[0].last;
  } catch (e) {
    console.log("Ошибка получения списка валют", e);
    return 0;
  }
  return last;

  //SELECT id FROM poolsdata ORDER BY id DESC LIMIT 1;
}

module.exports = start;
module.exports.GetPrise = GivePrise;
