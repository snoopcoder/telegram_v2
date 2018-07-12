const phin = require("phin").promisified;
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");

const tableName = config.poolsdata.tableName;

let PoolsList = ["eth-ru2.dwarfpool.com:8008", "eu1.ethermine.org:4444"];

function isNumber(obj) {
  return !isNaN(parseFloat(obj));
}

async function GetWeb(pool) {
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

  switch (pool) {
    case "eth-ru2.dwarfpool.com:8008": {
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
      Item.ETHcoinsPer24h = isNumber(response.earning_24_hours)
        ? response.earning_24_hours
        : 0;
      Item.ETHusdPerMin = 0;
      Item.ETHbalance = response.wallet_balance;
      Item.ETHtransferring_to_balance = response.transferring_to_balance;
      Item.ETHimmature_earning = response.immature_earning;
      Item.EthWorkersJSON = response.workers;
      break;
    } //https://api.ethermine.org/miner/0x1e758Cc212Cf5e2af9cd04E9ACA388a9d1cc6E77/workers/
    case "eu1.ethermine.org:4444": {
      urlCommon =
        "https://api.ethermine.org/miner/0x1e758Cc212Cf5e2af9cd04E9ACA388a9d1cc6E77/currentStats";
      urlWorker =
        "https://api.ethermine.org/miner/0x1e758Cc212Cf5e2af9cd04E9ACA388a9d1cc6E77/workers";

      let resCommon = {};
      let resWorkers = {};
      let data = [];
      try {
        resCommon = await phin({
          url: urlCommon,
          parse: "json"
        });
        resWorkers = await phin({
          url: urlWorker,
          parse: "json"
        });
        data = await Promise.all([resCommon, resWorkers]);
      } catch (e) {
        console.log("Error in GetWeb ");
        return 0;
      }

      let responseCommon = data[0].body;
      let responseWorkers = data[1].body;
      Item.ETHcurrentHashrate = (
        Number(responseCommon.data.currentHashrate) / 1000000
      ).toFixed(1);
      Item.ETHvalidShares = responseCommon.data.validShares;
      Item.ETHstaleShares = responseCommon.data.staleShares;
      Item.ETHinvalidShares = responseCommon.data.invalidShares;
      Item.ETHlastSeen = moment
        .unix(responseCommon.data.lastSeen)
        .format("YYYY-MM-DD HH:mm:ss");
      Item.ETHcoinsPer24h = (
        Number(responseCommon.data.coinsPerMin) *
        60 *
        24
      ).toFixed(5);
      Item.ETHusdPerMin = responseCommon.data.usdPerMin;
      Item.ETHbalance = (
        Number(responseCommon.data.unpaid) / 1000000000000000000
      ).toFixed(5);
      Item.ETHtransferring_to_balance = 0;
      Item.ETHimmature_earning = 0;

      //rigs
      let obj = {};
      for (worker of responseWorkers.data) {
        let OnDate = moment.unix(worker.lastSeen);
        OnDate = OnDate.format("YYYY-MM-DD HH:mm:ss");
        let IsActaul = moment(moment().format("YYYY-MM-DD HH:mm:ss")).diff(
          OnDate,
          "seconds"
        );
        let alive = IsActaul < 900 ? true : false;

        let rig = {
          alive: alive,
          hashrate: (Number(worker.currentHashrate) / 1000000).toFixed(2), //(            Number(responseCommon.data.currentHashrate) / 1000000          ).toFixed(1);
          hashrate_calculated: (
            Number(worker.reportedHashrate) / 1000000
          ).toFixed(2),
          last_submit: OnDate,
          second_since_submit: IsActaul,
          worker: worker.worker
        };
        obj[worker.worker] = rig;
      }
      Item.EthWorkersJSON = obj;
      break;
    }
    default:
      break;
  }

  return Item;
}

async function PutBase(Item, pool) {
  let poolId = await GetPoolId(pool);
  let q = dedent`
    INSERT INTO  ${tableName} SET 
    pool_id=?,
    on_date=?,
    balance=?,
    balance_immature=?,   
    coinsPer24hByPool=?,
    HashrateTotal=?,
    workers=?`;
  //await myconnection.Insert(q, param);
  try {
    let result = await query(q, [
      poolId,
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
async function getPollList() {
  let q = dedent`
  select name from pools where work=1`;
  let data = [];
  try {
    data = await query(q);
  } catch (e) {
    console.log("не создан список пулов getPollList(в GetDataFromPool.js)", e);
    return [];
  }
  let poollist = [];
  for (pool of data) {
    poollist.push(pool.name);
  }
  return poollist;
}

async function GetPoolId(poolName) {
  //get pool id
  let q = dedent`
  SELECT id FROM pools WHERE name=?`;
  //await myconnection.Insert(q, param);
  let id = "";
  try {
    id = await query(q, [poolName]);
  } catch (e) {
    console.log("не найден id пула PutBasePool(в GetClaymore.js)", e);
    return -1;
  }
  id = id[0].id;
  return id;
}

async function start() {
  //get curr poll
  let PoolList = await getPollList();
  for (pool of PoolList) {
    let Item = await GetWeb(pool);
    await PutBase(Item, pool);
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
      "Ошибка получения последнниз данных пула из базы GivePoolData (In GetDataFromPool.js)",
      e
    );
    return 0;
  }

  //вернуть данные
  return data;
}

async function GiveActivePoolList() {
  q = dedent`
  SELECT id,name from pools WHERE work =1`;
  let data = {};
  try {
    let result = await query(q);
    data = result;
  } catch (e) {
    console.log(
      "Ошибка получения списка рабочих пулов из базы GiveActivePoolList (In GetDataFromPool.js)",
      e
    );
    return 0;
  }

  //вернуть данные
  return data;
}

module.exports = start;
module.exports.GetPoolData = GivePoolData;
module.exports.GetActivePoolList = GiveActivePoolList;
