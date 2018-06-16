const phin = require("phin").promisified;
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");

const tableName = config.poolsdata.tableName;

async function GetWeb() {
  let Item = {
    ETHOnDate: 0,
    ETHcurrentHashrate: 0,
    ETHusdPerMin: 0,
    ETHvalidShares: 0,
    ETHstaleShares: 0,
    ETHinvalidShares: 0,
    ETHlastSeen: 0,
    ETHcoinsPer24h: 0,
    ETHusdPerMin: 0,
    ETHbalance: 0,
    ETHtransferring_to_balance: 0,
    ETHimmature_earning: 0,
    EthLast: 0,
    EthWorkersJSON: {}
  };
  Item.ETHOnDate = moment().format("YYYY-MM-DD HH:mm:ss");
  url =
    "http://dwarfpool.com/eth/api?wallet=0x1e758cc212cf5e2af9cd04e9aca388a9d1cc6e77&email=eth@example.com";

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

  let response = res.body;

  Item.ETHcurrentHashrate = response.total_hashrate;
  Item.ETHvalidShares = 0;
  Item.ETHstaleShares = 0;
  Item.ETHinvalidShares = 0;
  Item.ETHlastSeen = response.last_share_date;
  Item.ETHcoinsPer24h = response.earning_24_hours;
  Item.ETHusdPerMin = 0;
  Item.ETHbalance = response.wallet_balance;
  Item.ETHtransferring_to_balance = response.transferring_to_balance;
  Item.ETHimmature_earning = response.immature_earning;
  Item.EthWorkersJSON = response.workers;

  return Item;
}

async function PutBase(Item) {
  let q = dedent`
    INSERT INTO  ${tableName} SET 
    pool_id=1,
    on_date=?,
    balance=?,
    balance_immature=?,   
    coinsPer24hByPool=?,
    HashrateTotal=?,
    workers=?`;
  //await myconnection.Insert(q, param);
  try {
    let result = await query(q, [
      Item.ETHOnDate,
      Item.ETHbalance,
      Item.ETHimmature_earning,
      Item.ETHcoinsPer24h,
      Item.ETHcurrentHashrate,
      JSON.stringify(Item.EthWorkersJSON)
    ]);
  } catch (e) {
    console.log(e);
  }
}

async function start() {
  let Item = await GetWeb();
  await PutBase(Item);
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
    console.log("Ошибка получения списка валют", e);
    return 0;
  }

  //вернуть данные
  return data;
}

module.exports = start;
module.exports.GetPoolData = GivePoolData;
