/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "NANANA"
- Streams LTC
- Calculates momentum using a long and short average crossover and rate of change method.
- Takes the machine learning endpoint as a param for making decisions.
- Buys when it determines upwards momentum via rate of change and crossing over upwards.
- Adds to training data for machine learning component

RUNNING THIS:
forever start -o ~/Dutchess.ai/.tmp/nanana.out.log -e ~/Dutchess.ai/.tmp/nanana.err.log nanana.js

NOTES:

------
3/2/18
Added ml training
Thinking about also adding something so that if the profit is over the fee amount but the momentum
... begins to trend downward we cash out. Its an idea. Maybe there could be another training model.

------
Nanana is the current prod momentum algo trader. The 3rd iteration of my algo traders
I'm going to add some machine learning to the Nanana algo today 2/27/18

Add the training data to the training sheet every sell
Build another program that:
 1. Kills the nanana.js script. Or nanana.js can kill itself after its last sell after a certian time
 2. Retrains the machine learning models for nanana daily
 3. Restarts the nanana.js script with the new endpoint


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
const sheetId = secrets.NananaSheetId;
const trainingSheetId = secrets.NananaMlSheetId;
const async = require("async");
const fs = require("fs");
const axios = require("axios");
const mL = new AWS.MachineLearning({ region: "us-east-1" });

//const backtestTicks = require(constants.TMP + '/LTC.tickers.0153f8b2-ebf6-459f-8d30-d8607f10ce01.json');
const backtestTicks = require(constants.TMP +
  "/backTestData/LTC.tickers.ecd8775b-c35a-4fd9-8567-eba184574b54.json");

let test = false;

let doc = new GoogleSpreadsheet(sheetId);
let trainingDoc = new GoogleSpreadsheet(trainingSheetId);
let creds = require(constants.CONFIG + "/sheetsClientSecret.json");

let tickerData = [];
let overallAvgs = [];
let currentAvgs = [];
let holdingData = false;
let holdingDataCopy = false;
let count = 0;
let totalProfit = 0;
let profit = 0;
let stopLoss = 0;
let profitTarget = 0;
let feeRate = 0.003;
let totalFees = 0;
let winners = 0;
let losers = 0;
let orderCount = 0;
let currentState = 0;
let overallAvg = 0;
let crossOvers = [];
let date = moment();
let sheet;
let trainingSheet;
let realTimeEndpoint = false;
let modelId = false;
let GdaxClient;
let apiURI = "https://api.gdax.com";
let apiSandboxURI = "https://api-public.sandbox.gdax.com";

// Dials
let coin = ["LTC-USD"];
let currency = "LTC";
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;
let ticks = 9; //999; //1440;

async.series(
  [
    // Step 1.1
    function getEndpoint(step) {
      fs.readFile(constants.TMP + "/nanana/endpoint.json", function read(
        err,
        data
      ) {
        if (err) {
          throw err;
        }
        data = JSON.parse(data);
        realTimeEndpoint = data.endpoint;
        modelId = data.modelId;
        console.log("Step 1.1: Got Endpoint and ModelId");
        step();
      });
    },

    // Step 1.2 Config
    function config(step) {
      if (args[0] === "test") {
        test = true;
      }
      console.log("Step 1.2: Config", test, realTimeEndpoint);
      GdaxClient = authedClient(test);
      step();
    },

    // Step 2 Authenticate google sheets
    function setAuth(step) {
      console.log("Step 2.1: Authenticated Log Sheet");
      doc.useServiceAccountAuth(creds, step);
    },

    function setTrainingAuth(step) {
      console.log("Step 2.2: Authenticated Training Sheet");
      trainingDoc.useServiceAccountAuth(creds, step);
    },

    // Step 3 Get sheet
    function getInfoAndWorksheets(step) {
      doc.getInfo(function(err, info) {
        if (err) {
          console.log(err);
        }
        sheet = info.worksheets[0];
        console.log("Step 2.3: Got Log Sheet");
        step();
      });
    },

    function getTrainingInfoAndWorksheets(step) {
      trainingDoc.getInfo(function(err, info) {
        if (err) {
          console.log(err);
        }
        trainingSheet = info.worksheets[0];
        console.log("Step 2.4: Got Training Sheet");
        step();
      });
    },

    // Step 4 Init and run socket
    function init(step) {
      if (test) {
        console.log("Step 3: Initiate Backtest");
        initiateBackTest();
      } else {
        console.log("Step 3: Initiate");
        initiate();
      }
    }
  ],
  function(err) {
    if (err) {
      console.log("Error: " + err);
    }
  }
);

function initiate() {
  let ws = createWebsocket(test, coin);
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
    initiate();
    console.log("close");
  });
}

function initiateBackTest() {
  for (k in backtestTicks) {
    main(backtestTicks[k]);
  }
}

function main(data) {
  ++count;

  tickerData.push(data.price);
  if (tickerData.length > ticks) {
    tickerData.shift();
  }

  if (tickerData.length > ticks - 1) {
    currentIndex = tickerData.length - 1;
    lastIndex = tickerData.length - 2;

    overallAvg = getArrayAvg(tickerData);
    currentState = getArrayAvg([
      tickerData[tickerData.length - 1],
      tickerData[tickerData.length - 2]
    ]);

    overallAvgs.push(overallAvg);
    currentAvgs.push(currentState);

    console.log(
      currentState,
      overallAvg,
      currentAvgs[currentAvgs.length - 2],
      overallAvgs[overallAvgs.length - 2],
      profit,
      profitTarget,
      stopLoss,
      totalProfit - totalFees,
      orderCount,
      winners,
      losers
    );

    if (holdingData) {
      //profit = (tradeAmount * data.price / holdingData.price) - tradeAmount
      profit = (data.price - holdingData.price) * tradeAmountCoin;
      profitTarget = tradeAmountCoin * holdingData.price * target;
      stopLoss = tradeAmountCoin * holdingData.price * risk * -1;
    } else {
      profit = 0; // reset profit
      profitTarget = 0;
      stopLoss = 0;
    }

    // crossover up now state is over, last state is under
    if (
      currentState > overallAvg &&
      currentAvgs[currentAvgs.length - 2] <= overallAvgs[overallAvgs.length - 2]
    ) {
      crossOvers.push(overallAvg);
      if (crossOvers.length > 3) {
        crossOvers.shift();
      }

      let chunk = Math.ceil(tickerData.length / 3);
      let chunkArray = [];
      j = 0;
      for (let k in tickerData) {
        let chunkIndex = Math.floor(k / chunk);
        if (!chunkArray[chunkIndex]) {
          chunkArray[chunkIndex] = [];
        }
        chunkArray[chunkIndex].push(tickerData[k]);
      }

      let firstAvg = getArrayAvg(chunkArray[0]);
      let secondAvg = getArrayAvg(chunkArray[1]);
      let thirdAvg = getArrayAvg(chunkArray[2]);

      //for (i = 0, j = tickerData.length; i < j; i += chunk) {
      //    temparray = tickerData.slice(i, i + chunk);
      //    // do whatever
      //}
      //if ()
      console.log("Crossing Upwards", firstAvg, secondAvg, thirdAvg);
      //console.log(currentState, overallAvg, currentAvgs[currentAvgs.length - 2], overallAvgs[overallAvgs.length - 2], profit, profitTarget, stopLoss, totalProfit - totalFees, orderCount, winners, losers);

      //if (crossOvers.length >= 2) {
      //    if (crossOvers[crossOvers.length - 1] > crossOvers[crossOvers.length - 2]) {

      if (thirdAvg > secondAvg) {
        console.log("Upward Momentum Detected");
        //mode = 'trade'

        // buy on upward crossover if no holding
        if (!holdingData) {
          if (realTimeEndpoint) {
            let lastSvl =
              currentAvgs[currentAvgs.length - 2] -
              overallAvgs[overallAvgs.length - 2];
            let currentSvl = currentState - overallAvg;
            let rocAlpha = parseFloat(
              parseFloat(thirdAvg) / parseFloat(secondAvg) * 100
            ).toFixed(3);
            let rocBeta = parseFloat(
              parseFloat(secondAvg) / parseFloat(firstAvg) * 100
            ).toFixed(3);
            GdaxClient.getProduct24HrStats(coin[0], function(
              err,
              response,
              stats
            ) {
              let open = stats.open;
              let high = stats.high;
              let low = stats.low;
              let volume = stats.volume;

              /*
              var params = {
                MLModelId: modelId,
                PredictEndpoint: realTimeEndpoint,
                Record: {
                  time: moment().format("YYYY-MM-DD"),
                  price: String(data.price),
                  open: String(open),
                  high: String(high),
                  low: String(low),
                  volume: String(volume),
                  lastSvl: String(lastSvl),
                  currentSvl: String(currentSvl),
                  rocAlpha: String(rocAlpha),
                  rocBeta: String(rocBeta)
                }
              };
              */

              var params = {
                MLModelId: modelId,
                PredictEndpoint: realTimeEndpoint,
                Record: {
                  time: moment().format("YYYY-MM-DD"),
                  price: data.price,
                  open: open,
                  high: high,
                  low: low,
                  volume: volume,
                  lastSvl: String(lastSvl),
                  currentSvl: String(currentSvl),
                  rocAlpha: rocAlpha,
                  rocBeta: rocBeta
                }
              };

              console.log("PREDICT PARAMS", modelId, params);

              mL.predict(params, function(err, prediction) {
                if (err) {
                  console.log(err, err.stack);
                } else {
                  console.log("PREDICTION", prediction.label);

                  if (prediction.predictionLabel == "1") {
                    ++orderCount;
                    let fee = tradeAmountCoin * data.price * feeRate;
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    console.log("BUY");
                    if (!test) {
                      fix
                        .placeOrder(
                          "buy",
                          "market",
                          tradeAmountCoin,
                          coin[0],
                          false
                        )
                        .then(function(dataa, err) {
                          if (err) {
                            console.log(err);
                          }
                          //console.log('buy', dataa);
                          let newRow = {
                            time: data.time,
                            price: data.price,
                            status: "buy"
                          };
                          sheet.addRow(newRow, function(err) {
                            if (err) {
                              console.log(err);
                            }
                          });
                        });
                    }
                    holdingData = data;

                    // we need some additional data to be added to the machine learning training data later on when a sell occurs
                    holdingData.lastSvl = lastSvl;
                    holdingData.currentSvl = currentSvl;
                    holdingData.rocAlpha = rocAlpha;
                    holdingData.rocBeta = rocBeta;
                    holdingData.open = open;
                    holdingData.high = high;
                    holdingData.low = low;
                    holdingData.volume = volume;
                    console.log("TRAIN DATA", holdingData);
                  }
                }
              });
            });
          }
        }
      }
      //    }
      //}
    } else if (
      currentState < overallAvg &&
      currentAvgs[currentAvgs.length - 2] >= overallAvgs[overallAvgs.length - 2]
    ) {
      // crossover down
      console.log("Crossing Downwards");
      // Do nothing....
    } else {
      // no crossover
      if (holdingData) {
        if (profit >= profitTarget) {
          console.log("SELL");
          totalProfit = totalProfit + profit;
          let fee = tradeAmountCoin * data.price * feeRate;
          totalFees = parseFloat(totalFees) + parseFloat(fee);
          holdingDataCopy = holdingData;
          if (!test) {
            fix
              .placeOrder("sell", "market", tradeAmountCoin, coin[0], false)
              .then(function(dataa, err) {
                if (err) {
                  console.log(err);
                }
                console.log("sell", dataa);
                let newRow = {
                  time: data.time,
                  price: data.price,
                  status: "sell",
                  totalProfit: totalProfit
                };
                let newTrainingRow = {
                  time: holdingDataCopy.time,
                  price: holdingDataCopy.price,
                  open: holdingDataCopy.open,
                  high: holdingDataCopy.high,
                  low: holdingDataCopy.low,
                  volume: holdingDataCopy.volume,
                  lastSvl: holdingDataCopy.lastSvl,
                  currentSvl: holdingDataCopy.currentSvl,
                  rocAlpha: holdingDataCopy.rocAlpha,
                  rocBeta: holdingDataCopy.rocBeta,
                  status: 1
                };
                sheet.addRow(newRow, function(err) {
                  if (err) {
                    console.log(err);
                  }
                });
                trainingSheet.addRow(newTrainingRow, function(err) {
                  if (err) {
                    console.log(err);
                  }
                });
              });
          }
          holdingData = false;
          ++orderCount;
          ++winners;
          //mode = 'observe'
        } else if (profit <= stopLoss) {
          console.log("SELL");
          totalProfit = totalProfit + profit;
          let fee = tradeAmountCoin * data.price * feeRate;
          totalFees = parseFloat(totalFees) + parseFloat(fee);
          holdingDataCopy = holdingData;
          if (!test) {
            fix
              .placeOrder("sell", "market", tradeAmountCoin, coin[0], false)
              .then(function(dataa, err) {
                if (err) {
                  console.log(err);
                }
                console.log("sell", dataa);
                let newRow = {
                  time: data.time,
                  price: data.price,
                  status: "sell",
                  totalProfit: totalProfit
                };
                let newTrainingRow = {
                  time: holdingDataCopy.time,
                  price: holdingDataCopy.price,
                  open: holdingDataCopy.open,
                  high: holdingDataCopy.high,
                  low: holdingDataCopy.low,
                  volume: holdingDataCopy.volume,
                  lastSvl: holdingDataCopy.lastSvl,
                  currentSvl: holdingDataCopy.currentSvl,
                  rocAlpha: holdingDataCopy.rocAlpha,
                  rocBeta: holdingDataCopy.rocBeta,
                  status: 0
                };
                sheet.addRow(newRow, function(err) {
                  if (err) {
                    console.log(err);
                  }
                });
                trainingSheet.addRow(newTrainingRow, function(err) {
                  if (err) {
                    console.log(err);
                  }
                });
              });
          }
          holdingData = false;
          ++orderCount;
          ++losers;
          //mode = 'observe'
        } else {
          console.log("HOLD", profit * 100 / holdingData.price);
        }
      } else {
        // no hold yet
        console.log("NO HOLDING YET");
      }
    }
  } else {
    console.log("Getting ticks...");
  }
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

function createWebsocket(test, coin) {
  let wsUrl = "wss://ws-feed.gdax.com";
  if (test) {
    secrets.gDaxApiKey = secrets.gDaxSandboxApiKey;
    secrets.gDaxApiSecret = secrets.gDaxSandboxApiSecret;
    secrets.gDaxPassphrase = secrets.gDaxSandboxPassphrase;
    wsUrl = "wss://ws-feed-public.sandbox.gdax.com";
  }
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

function authedClient(test) {
  if (test) {
    apiURI = apiSandboxURI;
    secrets.gDaxApiKey = secrets.gDaxSandboxApiKey;
    secrets.gDaxApiSecret = secrets.gDaxSandboxApiSecret;
    secrets.gDaxPassphrase = secrets.gDaxSandboxPassphrase;
  }
  return new Gdax.AuthenticatedClient(
    secrets.gDaxApiKey,
    secrets.gDaxApiSecret,
    secrets.gDaxPassphrase,
    apiURI
  );
}
