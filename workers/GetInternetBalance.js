const phin = require("phin").promisified;
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");

async function PutBase(Item) {
  let q = dedent`
    INSERT INTO internetdata SET     
    ondate=?,
    balance=?,
    comment=?`;
  //await myconnection.Insert(q, param);
  try {
    let result = await query(q, [Item.ondate, Item.balance, Item.comment]);
  } catch (e) {
    console.log(e);
  }
}

async function GetWeb() {
  let Item = {
    ondate: 0,
    balance: 0,
    comment: ""
  };
  Item.ondate = moment().format("YYYY-MM-DD HH:mm:ss");
  url =
    "https://api.novotelecom.ru/user/v1/getDynamicInfo?token=uatn49fce6f391b14f05b9abe29cec6f6074&json";

  let res = {};
  try {
    res = await phin({
      url: url,
      parse: "json"
    });
  } catch (e) {
    console.log("Error in GetWeb ");
    return 0;
  }
  let response = res.body.response;
  Item.balance = response.balance;
  Item.comment = response.balanceInfo;
  return Item;
}

async function start() {
  let Item = await GetWeb();
  await PutBase(Item);
}

async function GiveBalance() {
  q = dedent`
    SELECT ondate,balance,comment from internetdata ORDER BY id DESC LIMIT 1`;
  let Item = {
    ondate: 0,
    balance: 0,
    comment: 0
  };
  try {
    let result = await query(q);
    Item = result[0];
  } catch (e) {
    console.log("Ошибка получения списка валют", e);
    return 0;
  }
  Item.ondate = Item.ondate;
  Item.balance = Item.balance;
  Item.comment = Item.comment;
  return Item;

  //SELECT id FROM poolsdata ORDER BY id DESC LIMIT 1;
}

module.exports = start;
module.exports.GetBalance = GiveBalance;
