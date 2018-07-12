require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const dedent = require("dedent");
var moment = require("moment");
var config = require("config");

var GetCurrencyPrise = require("./GetCurrencyPrise.js");
var GetDataFromPool = require("./GetDataFromPool.js");
var GetInternetBalance = require("./GetInternetBalance");
var GetClaymore = require("./GetClaymore");

function fixTime(time) {
  let quotient = Math.floor(time / 60);
  let remainder = time % 60;
  time = dedent`${quotient}m${remainder}s`;
  return time;
}

function FixLength(STRm, column) {
  let str = STRm;
  let LengthBook = {
    Name: 6,
    Status: 7,
    Hashrate: 10,
    Old: 6
  };
  let defdf = str.length;
  switch (column) {
    case "Name": {
      if (str.length < LengthBook.Name) {
        let Needed = LengthBook.Name - str.length;
        for (let i = 0; i < Needed; i++) str = str + " ";
      }
      break;
    }
    case "Status": {
      if (str.length < LengthBook.Status) {
        let Needed = LengthBook.Status - str.length;
        for (let i = 0; i < Needed; i++) str = str + " ";
      }
      break;
    }
    case "Hashrate": {
      if (str.length < LengthBook.Hashrate) {
        let Needed = LengthBook.Hashrate - str.length;
        for (let i = 0; i < Needed; i++) str = str + " ";
      }
      break;
    }
  }
  return str;
}

async function PrepareMess(infoType) {
  let Mess = "";
  //какие пулы актуальны
  let ActivePoolList = await GetDataFromPool.GetActivePoolList();
  let poolsArray = [];
  //получить данные о каждом
  for (pool of ActivePoolList) {
    let data = await GetDataFromPool.GetPoolData(pool.id);
    let OnDate = moment(data.on_date);
    OnDate = OnDate.format("YYYY-MM-DD HH:mm:ss");
    let IsActaul = moment(moment().format("YYYY-MM-DD HH:mm:ss")).diff(
      OnDate,
      "minutes"
    );
    IsActaul = IsActaul < 15 ? true : false;
    let poolData = {};
    poolData.name = pool.name;
    poolData.OnDate = OnDate;
    poolData.IsActaul = IsActaul;
    poolData.data = data;
    poolsArray.push(poolData);
  }
  //собрать сообщение
  switch (infoType) {
    case "pool": {
      let curr_last = await GetCurrencyPrise.GetPrise("ETH");
      for (pool of poolsArray) {
        Mess =
          dedent`
        <pre>Pool:     ${pool.name}
        Hashrate: ${pool.data.HashrateTotal}Mh
        Profit: ${pool.data.coinsPer24hByPool}ETH(${(
            pool.data.coinsPer24hByPool * curr_last
          ).toFixed(1)}$)  
        Balance:  ${pool.data.balance + pool.data.balance_immature}</pre>` +
          "\n" +
          Mess;
        if (!pool.IsActaul) Mess = "\u26A0 данные не актуальны \n" + Mess;
      }
      break;
    }
    case "miners": {
      for (pool of poolsArray) {
        let data = pool.data;
        let workers = JSON.parse(data.workers);
        let RigMessAll = dedent`<pre> Name      Hashrate   Old
          ----------------------------</pre>`;

        for (let rigId in workers) {
          let rig = workers[rigId];
          let RigMess = dedent`<pre>${
            rig.alive ? "\u{2705}" : "\u{1F534}"
          } ${FixLength(rig.worker, "Name")} ${FixLength(
            Math.floor(rig.hashrate) +
              "[" +
              Math.floor(rig.hashrate_calculated) +
              "]Mh",
            "Hashrate"
          )} ${fixTime(rig.second_since_submit)}
          ----------------------------</pre>`;
          RigMessAll = RigMessAll + RigMess;
        }
        if (!pool.IsActaul)
          RigMessAll = "\u26A0 данные не актуальны \n" + RigMessAll;
        Mess = Mess + "<pre>" + pool.name + "\n</pre>" + RigMessAll;
      }

      break;
    }
    case "report": {
      let data = await GetInternetBalance.GetBalance();
      let OnDate = moment(data.ondate);
      OnDate = OnDate.format("YYYY-MM-DD");
      let IsActaul = moment(moment().format("YYYY-MM-DD")).isSame(OnDate);
      if (IsActaul) {
        Mess =
          dedent`
       Баланс Новотелком: ${data.balance}руб (${data.comment})` + "\n";
      } else {
        Mess =
          dedent`
        Баланс Новотелком: данные устарели` + "\n";
      }
      let Cleymoredata = await GetClaymore.GetData();
      Mess = Mess + Cleymoredata;
      break;
    }
  }
  return Mess;
}

TelegramChats = {
  Egor: 439391637,
  Tan4ik: 0
};

async function start() {
  //let Mess = await PrepareMess();

  let token = process.env.myDebug
    ? config.telegram.tokendebug
    : config.telegram.token;

  // Create a bot that uses 'polling' to fetch new updates
  const bot = new TelegramBot(token, { polling: true });

  //bot.sendMessage('Bot started');
  // Matches "/echo [whatever]"
  bot.onText(/\/echo (.+)/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message

    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"

    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
  });

  // Listen for any kind of message. There are different kinds of
  // messages.
  bot.on("message", async msg => {
    const chatId = msg.chat.id;
    switch (msg.text.toString()) {
      case "pool info": {
        Msg = await PrepareMess("pool");
        bot.sendMessage(chatId, Msg, {
          parse_mode: "HTML"
        });
        break;
      }
      case "miners info": {
        Msg = await PrepareMess("miners");
        bot.sendMessage(chatId, Msg, {
          parse_mode: "HTML"
        });
        break;
      }
      case "report": {
        Msg = await PrepareMess("report");
        bot.sendMessage(chatId, Msg, {
          parse_mode: "HTML"
        });
        break;
      }
      case "/start": {
        var option = {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [{ text: "pool info" }, { text: "miners info" }],
              [{ text: "report" }]
            ],
            resize_keyboard: true
          }
        };
        bot.sendMessage(chatId, "Давай начнем, тыкай кнопки", option);
        break;
      }
      default: {
        bot.sendMessage(
          chatId,
          dedent`${"\u{1F916}"} команда нераспознана, мне далеко до сири((
            все что я могу /start`,
          {
            parse_mode: "HTML"
          }
        );
        break;
      }
    }

    console.log(Date() + " " + chatId + " inbond chat");
  });
}
//439391637
//debugbot

/*
function TelegramBot() {
  this.bot = new TelegramBot(token, { polling: true });
}*/

module.exports = start;
