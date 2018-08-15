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

async function GiveBalances() {
  q = dedent`
SELECT walletsdata.id,
  curr_id,
  walletsdata.data,
  walletsdata.wallet_id,
  inline.name,
  factor,
  walletsdata.balance,
  symbol
FROM walletsdata
JOIN
(SELECT wallet_id,
     max(DATA) AS DATA,
WORK,
     name,
     factor,
     curr_id
FROM walletsdata
JOIN wallets ON walletsdata.wallet_id = wallets.id
WHERE
WORK=1
GROUP BY wallet_id) AS inline ON walletsdata.wallet_id = inline.wallet_id
AND walletsdata.data = inline.data
JOIN currencies ON currencies.id=curr_id;;`;
  let BalancesList = [];
  try {
    let result = await query(q);
    BalancesList = result;
  } catch (e) {
    console.log("Ошибка получения списка валют", e);
    return 0;
  }
  return BalancesList;
}

module.exports = start;
module.exports.GetBalances = GiveBalances;
