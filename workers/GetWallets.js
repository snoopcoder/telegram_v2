const phin = require("phin").promisified;
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");
var get = require("lodash.get");

async function GetWeb(wallet) {
  let balance = 0;
  url = wallet.url;
  let res = {};
  try {
    res = await phin({
      url: url,
      parse: "json"
    });
  } catch (e) {
    console.log("Error in GetWeb of GetWallets.js");
    return 0;
  }
  let response = res.body;
  balance = get(response, wallet.balance_key);
  return balance;
}

async function PutBase(balance, wallet) {
  let q = dedent`
    INSERT INTO  walletsdata SET 
    wallet_id=?,
    balance=?`;
  //await myconnection.Insert(q, param);
  try {
    let result = await query(q, [wallet.id, balance]);
  } catch (e) {
    console.log("PutBase in GetWallets.js", e);
  }
}
async function getWalletsList() {
  let q = dedent`
  select * from wallets where work=1`;
  let data = [];
  try {
    data = await query(q);
  } catch (e) {
    console.log(
      "не создан список кошельков getWalletsList(в GetWalletsData.js)",
      e
    );
    return [];
  }
  let WalletsList = data;
  return WalletsList;
}

async function start() {
  //get curr poll
  let WalletsList = await getWalletsList();
  for (wallet of WalletsList) {
    let balance = await GetWeb(wallet);
    await PutBase(balance, wallet);
  }
}

async function GivePoolData(pool_id) {
  //сделать запрос в базу
  q = dedent`
  SELECT on_date,balance,balance_immature,coinsPer24hByPool,HashrateTotal,workers from poolsdata WHERE pool_id =? ORDER BY id DESC LIMIT 1`;
  let data = {};
  try {
    let result = await query(q, [pool_id]);
    data = result[0];
  } catch (e) {
    console.log(
      "Ошибка получения последнниз данных пула из базы GivePoolData (In GetWalletsData.js)",
      e
    );
    return 0;
  }

  //вернуть данные
  return data;
}

async function GiveWalletsData() {
  q = dedent`
  SELECT * from wallets WHERE work =1`;
  let data = {};
  try {
    let result = await query(q);
    data = result;
  } catch (e) {
    console.log(
      "Ошибка получения списка рабочих пулов из базы GiveActiveWalletsList (In GetWalletsData.js)",
      e
    );
    return 0;
  }

  //вернуть данные
  return data;
}

module.exports = start;
//module.exports.GetWalletsData = GiveWalletsData;
