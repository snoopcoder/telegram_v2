const net = require("net");
var query = require("mysql-query-promise");
var config = require("config");
const dedent = require("dedent");
var moment = require("moment");

let rigs = {
  rig1: {
    name: "rig1",
    adress: "192.168.88.27"
  },
  rig2: {
    name: "rig2",
    adress: "192.168.88.22"
  },
  rig3: {
    name: "rig3",
    adress: "192.168.88.21"
  },
  rig4: {
    name: "rig4",
    adress: "192.168.88.20"
  },
  rig1_2: {
    name: "rig1-2",
    adress: "192.168.88.50"
  },
  inv1: {
    name: "inv1",
    adress: "192.168.88.13"
  },
  test: {
    name: "test",
    adress: "192.168.88.15"
  }
};

const timeout = 5000;
//const port = "3333";
//const host = "192.168.88.22";

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

async function GiveData() {
  let All = "";
  for (let rig in rigs) {
    //console.log(rigs[rig].name, rigs[rig].adress);
    let res = "";
    try {
      res = await GetData(rigs[rig].adress, "3333");
    } catch (e) {
      console.log("connection error", rigs[rig].adress, e);
      All +=
        "--------\n" + rigs[rig].name + ":\nconnection error \n" + e + "\n";
      continue;
    }
    let RigInfo = toStatsJson(res);
    let Mess =
      dedent`--------
    ${rigs[rig].name}:   ${RigInfo.ethash.hashrate}MH 
    shares: ${RigInfo.ethash.shares.successful}   rejected: ${
        RigInfo.ethash.shares.rejected
      } invalid: ${RigInfo.ethash.shares.invalid}
    sensor ${gpuinfo(RigInfo.sensors)}` + "\n";
    All = All + Mess;
  }
  return All;
}

async function start() {
  let Item = await GiveData();
  //await PutBase(Item);
}

module.exports = start;
module.exports.GetData = GiveData;
