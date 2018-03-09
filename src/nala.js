/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "NALA"
- Streams LTC
- Momentum crossover
- Volume Crossover
- Bailout Technology
- Machine Learning Decision Making
- Limit Orders
*/

const constants = require("./lib/_constants.js");
const secrets = require(constants.CONFIG + "/secrets.json");
const moment = require("moment");
const args = process.argv.slice(2);
const sms = require(constants.LIB + "/sms.js");
const fix = require(constants.LIB + "/fix.js");
const rsiLtc = require(constants.LIB + "/rsi-ltc.js");
const AWS = require("aws-sdk");
const uuid = require("node-uuid");
const Gdax = require("gdax");
const GoogleSpreadsheet = require("google-spreadsheet");
const trainingSheetId = secrets.NalaTrainingSheetId;
const async = require("async");
const fs = require("fs");
const axios = require("axios");
const mL = new AWS.MachineLearning({ region: "us-east-1" });
const shell = require("shelljs");
const apiURI = "https://api.gdax.com";

let trainingDoc = new GoogleSpreadsheet(trainingSheetId);
let creds = require(constants.CONFIG + "/sheetsClientSecret.json");

let machineLearning = false;
let machineLearningData = false;
let coin = ["LTC-USD"];
let count = 0;
let tickerData = [];
let volumeData = [];
let longMomentumAvgs = [];
let shortMomentumAvgs = [];
let longVolumeAvgs = [];
let shortVolumeAvgs = [];
let holdingData = false;
let holdingDataCopy = false;
let profit = 0;
let profitTarget = 0;
let stopLoss = 0;
let totalProfit = 0;
let winners = 0;
let losers = 0;
let sellSignal = false;
let feeRate = 0.003;
let totalFees = 0;

// Dials
let ticks = 60;
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;

// Initial series
async.series(
  [
    // Step 1
    function configMachieLearning(step) {
      if (machineLearning === true) {
        returnJsonFileObject(constants.TMP + "/nala/endpoint.json").then(
          function(data, err) {
            console.log("Machine Learning On");
            machineLearningData = data;
            step();
          }
        );
      } else {
        console.log("Machine Learning Off");
        step();
      }
    },

    // Step 2 Config Gdax, Google Sheets
    function configApi(step) {
      GdaxClient = authedClient();
      trainingDoc.useServiceAccountAuth(creds, step);
    },

    // Step 3 Get Training Sheet, we always train even not in machineLearning mode
    function getTrainingWorksheet(step) {
      trainingDoc.getInfo(function(err, info) {
        if (err) {
          console.log(err);
        }
        trainingSheet = info.worksheets[0];
        console.log("Got Training Sheet");
        step();
      });
    },

    // Step 4 Init and run socket
    function init(step) {
      initiateWebSocket();
    }
  ],
  function(err) {
    if (err) {
      console.log("Error: " + err);
    }
  }
);

function main(data) {
  ++count;

  tickerDataPush(data);

  async.series(
    [
      function pushVolume(step) {
        volumeDataPush().then(function() {
          step();
        });
      },
      function tickerDataHandler(step) {
        if (tickerData.length > ticks - 1) {
          handleTickerData(data).then(function(data, err) {
            console.log("handleTickerData", count);
            step();
          });
        }
      }
    ],
    function(err) {
      if (err) {
        console.log("Error: " + err);
      }
    }
  );
}

function handleTrading(data) {
  return new Promise(function(resolve, reject) {
    console.log(
      "Status",
      volumeCrossesUpwards(),
      momentumIsUp(),
      momentumIsDown()
    );

    // if volume crosses up and momentum is up
    // and we have a sellSignal then cancel it
    if (volumeCrossesUpwards() && momentumIsUp() && sellSignal) {
      sellSignal = false;
    } else if (volumeCrossesUpwards() && momentumIsUp() && !holdingData) {
      // if volume crosses up and momentum is upward
      // and holding
      // if ml then query endpoint
      console.log("BUY SIGNAL");
      if (machineLearning) {
        // ML AREA
        console.log("Machine Learning");
      } else {
        // IF ML is off then just to a standard buy
        buy(data).then(function(data, err) {
          if (err) {
            console.log(err);
            reject(err);
          }
          //console.log("buys success", data);
          resolve(data);
        });
      }
    } else if (volumeCrossesUpwards() && momentumIsDown() && holdingData) {
      console.log("SELL SIGNAL");
      sellSignal = true;
      sellBail(data).then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(data);
      });
    } else {
      if (holdingData) {
        console.log(
          "HOLDING",
          profit,
          profitTarget,
          stopLoss,
          totalProfit,
          winners,
          losers
        );

        async.parallel(
          [
            function(callback) {
              sellStopLoss(data).then(function(data, err) {
                //
                callback(null, data);
              });
            },
            function(callback) {
              sellTarget(data).then(function(data, err) {
                //
                callback(null, data);
              });
            },
            function(callback) {
              sellBail(data).then(function(data, err) {
                callback(null, data);
              });
            }
          ],
          function(err, results) {
            if (err) {
              console.log(err);
              reject(err);
            }
            console.log(results);
            resolve(results);
          }
        );
      } else {
        // No holding yet
        console.log("NO HOLDING", totalProfit);
        resolve();
      }
    }
  });
}

function buy(data) {
  return new Promise(function(resolve, reject) {
    price = data.price;
    fix
      .placeOrder("buy", "limit", tradeAmountCoin, coin[0], false, price, "FOK")
      .then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        console.log("BUY", price, data);
        if (data.status == "rejected") {
          reject(data);
        } else {
          let fee = tradeAmountCoin * price * feeRate;
          totalFees = parseFloat(totalFees) + parseFloat(fee);
          holdingData = data;
          resolve(data);
        }
      });
  });
}

function sell(data) {
  return new Promise(function(resolve, reject) {
    price = data.price;
    fix
      .placeOrder(
        "sell",
        "limit",
        tradeAmountCoin,
        coin[0],
        false,
        price,
        "FOK"
      )
      .then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        console.log("SELL", price, data);
        if (data.status == "rejected") {
          reject(data);
        } else {
          let fee = tradeAmountCoin * price * feeRate;
          totalFees = parseFloat(totalFees) + parseFloat(fee);
          totalProfit = totalProfit + profit;
          hodingData = false;
          sellSignal = false;
          resolve(data);
        }
      });
  });
}

function sellStopLoss(data) {
  return new Promise(function(resolve, reject) {
    if (profit <= stopLoss) {
      console.log("SELL STOPLOSS");
      sell(data).then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        ++losers;
        resolve(data);
      });
    } else {
      resolve();
    }
  });
}

function sellBail(data) {
  return new Promise(function(resolve, reject) {
    let fee = tradeAmountCoin * data.price * feeRate;
    if (profit >= fee * 2 && sellSignal) {
      console.log("SELL BAIL");
      sell(data).then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        ++winners;
        resolve(data);
      });
    } else {
      resolve();
    }
  });
}

function sellTarget(data) {
  return new Promise(function(resolve, reject) {
    // if holding lets stoploss here
    if (profit >= profitTarget) {
      console.log("SELL TARGET");
      sell(data).then(function(data, err) {
        if (err) {
          console.log(err);
          reject(err);
        }
        ++winners;
        resolve(data);
      });
    } else {
      resolve();
    }
  });
}

function volumeCrossesUpwards() {
  console.log(
    "Volume Crossover",
    shortVolumeAvgs[shortVolumeAvgs.length - 1] -
      longVolumeAvgs[longVolumeAvgs.length - 1],
    "|",
    shortVolumeAvgs[shortVolumeAvgs.length - 2] -
      longVolumeAvgs[longVolumeAvgs.length - 2]
  );

  if (
    shortVolumeAvgs[shortVolumeAvgs.length - 1] >
      longVolumeAvgs[longVolumeAvgs.length - 1] &&
    shortVolumeAvgs[shortVolumeAvgs.length - 2] <=
      longVolumeAvgs[longVolumeAvgs.length - 2]
  ) {
    return true;
  } else {
    return false;
  }
}

function momentumIsUp() {
  if (
    shortMomentumAvgs[shortMomentumAvgs.length - 1] >
    longMomentumAvgs[longMomentumAvgs.length - 1]
  ) {
    return true;
  } else {
    return false;
  }
}

function momentumIsDown() {
  if (
    shortMomentumAvgs[shortMomentumAvgs.length - 1] <
    longMomentumAvgs[longMomentumAvgs.length - 1]
  ) {
    return true;
  } else {
    return false;
  }
}

function calculateMomentum() {
  console.log("Calculate Momentum");
  let longMomentumAvg = getArrayAvg(tickerData);
  let shortMomentumAvg = getArrayAvg([
    tickerData[tickerData.length - 1],
    tickerData[tickerData.length - 2]
  ]);
  longMomentumAvgs.push(longMomentumAvg);
  shortMomentumAvgs.push(shortMomentumAvg);
}

function calculateVolume() {
  console.log("Calculate Volume");
  let longVolumeAvg = getArrayAvg(volumeData);
  let shortVolumeAvg = getArrayAvg([
    volumeData[volumeData.length - 1],
    volumeData[volumeData.length - 2]
  ]);
  longVolumeAvgs.push(longVolumeAvg);
  shortVolumeAvgs.push(shortVolumeAvg);
}

function calculateProfitLoss(data) {
  console.log("Calculate Profit Loss");
  if (holdingData) {
    profit = (data.price - holdingData.price) * tradeAmountCoin;
    profitTarget = tradeAmountCoin * holdingData.price * target;
    stopLoss = tradeAmountCoin * holdingData.price * risk * -1;
  } else {
    // reset profit
    profit = 0;
    profitTarget = 0;
    stopLoss = 0;
  }
}

function handleTickerData(data) {
  return new Promise(function(resolve, reject) {
    calculateMomentum();
    calculateVolume();
    calculateProfitLoss(data);
    handleTrading(data).then(function(data, err) {
      if (err) {
        console.log(err);
        reject(err);
      }
      resolve(data);
    });
  });
}

function tickerDataPush(data) {
  if (data && typeof data.price != "undefined") {
    console.log("Push Ticker Data", count, data.price);
    tickerData.push(data.price);
    if (tickerData.length > ticks) {
      tickerData.shift();
    }
  }
}

function volumeDataPush() {
  return new Promise(function(resolve, reject) {
    GdaxClient.getProductTicker(coin[0], function(err, data, response) {
      if (err) {
        console.log(err);
        reject(err);
      }
      if (response && typeof response.volume != "undefined") {
        console.log("Push Volume Data", count, response.volume);
        volumeData.push(response.volume);
        if (volumeData.length > ticks) {
          volumeData.shift();
        }
      }
      resolve();
    });
  });
}

function initiateWebSocket() {
  let ws = createWebsocket(coin);
  ws.on("message", data => {
    if (data.type === "ticker") {
      main(data);
    }
  });

  ws.on("error", err => {
    console.log("error", err);
  });

  ws.on("close", () => {
    delete ws;
    initiateWebSocket();
    console.log("close");
  });
}

function returnJsonFileObject(file) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, function read(err, data) {
      if (err) {
        reject(err);
      }
      data = JSON.parse(data);
      resolve(data);
    });
  });
}

function authedClient() {
  console.log("Config Gdax");

  return new Gdax.AuthenticatedClient(
    secrets.gDaxApiKey,
    secrets.gDaxApiSecret,
    secrets.gDaxPassphrase,
    apiURI
  );
}

function createWebsocket(coin) {
  let wsUrl = "wss://ws-feed.gdax.com";
  console.log("Websocket Established");
  return new Gdax.WebsocketClient(
    coin,
    wsUrl,
    {
      key: secrets.gDaxApiKey,
      secret: secrets.gDaxApiSecret,
      passphrase: secrets.gDaxPassphrase
    },
    { channels: ["ticker"] }
  );
}

function getArrayAvg(elmt) {
  var sum = 0;
  for (var i = 0; i < elmt.length; i++) {
    sum += parseFloat(elmt[i]); //don't forget to add the base
  }
  var avg = sum / elmt.length;
  //console.log('AVG', avg)
  return avg;
}
