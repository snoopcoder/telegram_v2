const net = require("net");
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");

const timeout = 1000;

function GetData(host, port) {
  let MyPromis = new Promise((resolve, reject) => {
    const request =
      JSON.stringify({
        id: 0,
        jsonrpc: "2.0",
        method: "miner_getstat1"
      }) + "\n";

    const socket = new net.Socket()
      .on("connect", () => {
        socket.write(request);
        socket.setTimeout(timeout);
      })
      .on("timeout", () => {
        reject(`Claymore didnt answer within ${timeout}ms.`);
        socket.destroy();
      })
      .on("data", data => {
        const result = JSON.parse(data.toString().trim()).result;
        resolve(result);
      })
      .on("error", e => {
        reject(e.message);
      });

    socket.connect(
      port,
      host
    );
  });

  return MyPromis;
}

function parseHashrate(hashrate) {
  return hashrate === "off" ? 0 : Number(hashrate) / 1000;
}

function parseCardHashrates(hashrates) {
  return hashrates.split(";").map(parseHashrate);
}

function parseStats(stats, InvalidShares) {
  const [totalHashrate, successfulShares, rejectedShares] = stats.split(";");
  return {
    hashrate: parseHashrate(totalHashrate),
    shares: {
      successful: Number(successfulShares),
      rejected: Number(rejectedShares),
      invalid: Number(InvalidShares)
    }
  };
}

function parseCardTemperaturesFunSpeeds(temperatureFanSpeeds) {
  const parsed = temperatureFanSpeeds.split(";");
  let grouped = [];
  let index = 0;
  while (parsed.length !== 0) {
    const temperature = Number(parsed[0]);
    const fanSpeed = Number(parsed[1]);
    parsed.splice(0, 2);
    grouped = [...grouped, { index, temperature, fanSpeed }];
    index++;
  }
  return grouped;
}

function parseCoin(stats, hashrates, InvalidShares, pool, poolSwitches) {
  return Object.assign({}, parseStats(stats, InvalidShares), {
    cardHashrates: parseCardHashrates(hashrates),
    pool,
    poolSwitches
  });
}

function parseInvalidShares(aggregatedStatsPosition, result) {
  if (!aggregatedStatsPosition) {
    return [];
  }
  const [ethInvalidshares, , dcoinInvalidshares] = result[
    aggregatedStatsPosition
  ].split(";");
  return [Number(ethInvalidshares), Number(dcoinInvalidshares)];
}

function parsePoolSwitches(aggregatedStatsPosition, result) {
  if (!aggregatedStatsPosition) {
    return [];
  }
  const [, ethPoolSwitches, , dcoinPoolSwitches] = result[
    aggregatedStatsPosition
  ].split(";");
  return [Number(ethPoolSwitches), Number(dcoinPoolSwitches)];
}

function toStatsJson(result) {
  let positions = {
    version: 0,
    uptime: 1,
    ethashStats: 2,
    ethashHr: 3,
    dcoinStats: 4,
    dcoinhHr: 5,
    temperatureFanSpeeds: 6,
    pools: 7,
    aggregatedStats: 8
  };
  const pools = positions.pools ? result[positions.pools].split(";") : [];
  const poolSwitches = parsePoolSwitches(positions.aggregatedStats, result);
  const poolInvalidShares = parseInvalidShares(
    positions.aggregatedStats,
    result
  );

  return {
    claymoreVersion: result[positions.version],
    uptime: positions.uptime ? Number(result[positions.uptime]) : undefined,
    ethash:
      positions.ethashStats && positions.ethashHr
        ? parseCoin(
            result[positions.ethashStats],
            result[positions.ethashHr],
            poolInvalidShares[0],
            pools[0],
            poolSwitches[0]
          )
        : undefined,
    dcoin:
      positions.dcoinStats && positions.dcoinhHr
        ? parseCoin(
            result[positions.dcoinStats],
            result[positions.dcoinhHr],
            poolInvalidShares[1],
            pools[1],
            poolSwitches[1]
          )
        : undefined,
    sensors: positions.temperatureFanSpeeds
      ? parseCardTemperaturesFunSpeeds(result[positions.temperatureFanSpeeds])
      : undefined
  };
}

function gpuinfo(sensors) {
  let j = 0;
  let res = "";
  let textGPU = "GPU:\n";
  let textTemper = "";
  let textFan = "";
  for (let i of sensors) {
    textGPU += dedent`${j}` + "      ";
    textTemper += dedent`${i.temperature}C` + " ";
    textFan += dedent`${i.fanSpeed}% ` + " ";
    j++;
  }
  res = textGPU + "\n" + textTemper + "\n" + textFan;
  return res;
}

async function GrubMiners(rigs) {
  let All = {
    rigs: []
  };
  for (let rig of rigs) {
    //console.log(rigs[rig].name, rigs[rig].adress);
    let res = "";
    let rigObj = {
      name: "",
      status: "",
      claymoreVersion: "",
      pool: "",
      uptime: 0,
      totalHashrate: 0,
      shares_good: 0,
      shares_rej: 0,
      share_inv: 0,
      gpu_array: []
    };
    try {
      res = await GetData(rig.address, "3333");
    } catch (e) {
      console.log("connection error", rig.address, e);
      rigObj.name = rig.name;
      rigObj.status = "connection error";
      All.rigs.push(rigObj);
      continue;
    }
    let RigInfo = toStatsJson(res);
    rigObj.name = rig.name;
    rigObj.address = rig.address;
    rigObj.status = "ok";
    rigObj.claymoreVersion = RigInfo.claymoreVersion;
    rigObj.uptime = RigInfo.uptime;
    rigObj.pool = RigInfo.ethash.pool;
    rigObj.totalHashrate = RigInfo.ethash.hashrate;
    rigObj.shares_good = RigInfo.ethash.shares.successful;
    rigObj.shares_rej = RigInfo.ethash.shares.rejected;
    rigObj.share_inv = RigInfo.ethash.shares.invalid;
    rigObj.gpu_array = RigInfo.sensors;
    All.rigs.push(rigObj);
  }
  return All;
}

async function GiveData(rigs) {
  let All = "";
  for (let rig of rigs) {
    //console.log(rigs[rig].name, rigs[rig].adress);
    let res = "";
    try {
      res = await GetData(rig.address, "3333");
    } catch (e) {
      console.log("connection error", rig.address, e);
      All += "--------\n" + rig.name + ":\nconnection error \n" + e + "\n";
      continue;
    }
    let RigInfo = toStatsJson(res);
    let Mess =
      dedent`--------
    ${rig.name}:   ${RigInfo.ethash.hashrate}MH 
    shares: ${RigInfo.ethash.shares.successful}   rejected: ${
        RigInfo.ethash.shares.rejected
      } invalid: ${RigInfo.ethash.shares.invalid}
    sensor ${gpuinfo(RigInfo.sensors)}` + "\n";
    All = All + Mess;
  }
  return All;
}

async function PutBase(Item) {
  let q = dedent`
    INSERT INTO rigsdata SET     
    data=?`;
  //await myconnection.Insert(q, param);
  try {
    let result = await query(q, [JSON.stringify(Item)]);
  } catch (e) {
    console.log(e);
  }
}

async function start() {
  let RigList = await GetRigList();
  let Item = await GrubMiners(RigList);
  await PutBase(Item);
}

async function GetRigList() {
  //сделать запрос в базу
  q = dedent`
    SELECT name,address from rigs;`;
  let RigList = [];
  try {
    RigList = await query(q);
  } catch (e) {
    console.log("Ошибка получения списка ригов", e);
    return 0;
  }

  return RigList;
}

async function GiveDataWrapper() {
  let RigList = await GetRigList();
  return await GiveData(RigList);
}

module.exports = start;
module.exports.GetData = GiveDataWrapper;
