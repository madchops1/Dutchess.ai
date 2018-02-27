/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "NANANA"
- Streams BTC or ETH or LTC forever
- Calculates momentum between ticks
- when we get x positive momentum reads buy in
- then wait until we get x down tick b4 selling
forever start -o ~/Dutchess.ai/.tmp/nanana.out.log -e ~/Dutchess.ai/.tmp/nanana.err.log nanana.js

NOTES:
Nanana is the current prod momentum algo trader. The 3rd iteration of my algo traders
*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const args = process.argv.slice(2);
const sms = require(constants.LIB + '/sms.js');
const fix = require(constants.LIB + '/fix.js');
//const backtestTicks = require(constants.TMP + '/LTC.tickers.0153f8b2-ebf6-459f-8d30-d8607f10ce01.json');
const backtestTicks = require(constants.TMP + '/backTestData/LTC.tickers.ecd8775b-c35a-4fd9-8567-eba184574b54.json');
const AWS = require('aws-sdk');
const uuid = require('node-uuid');
const Gdax = require('gdax');
const GoogleSpreadsheet = require('google-spreadsheet');
const sheetId = secrets.NananaSheetId;
const async = require('async');

let test = false;
if (args[0] === 'test') { test = true; }

let doc = new GoogleSpreadsheet(sheetId);
let creds = require(constants.CONFIG + '/sheetsClientSecret.json');

let tickerData = [];
let overallAvgs = [];
let currentAvgs = [];
let holdingData = false;
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

// Dials
let coin = ['LTC-USD'];
let currency = 'LTC';
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;
let ticks = 1440;

async.series([

    // Step 1 Authenticate google sheets
    function setAuth(step) {
        console.log('Step 1: Authenticated Google Sheets');
        doc.useServiceAccountAuth(creds, step);
    },

    // Step 2 Get sheet
    function getInfoAndWorksheets(step) {
        doc.getInfo(function (err, info) {
            sheet = info.worksheets[0];
            console.log('Step 2: Get Sheet Successful, ' + sheet.rowCount + ' rows');
            step();
        });
    },

    // Step 3 Init and run socket
    function init(step) {
        if (test) {
            initiateBackTest();
        } else {
            initiate();
        }
    }

],
    function (err) {
        if (err) {
            console.log('Error: ' + err);
        }
    }
);

function initiate() {
    let ws = createWebsocket(test, coin);
    ws.on('message', data => {
        if (data.type === 'ticker') {
            main(data);
        }
    });

    ws.on('error', err => {
        console.log('error', err);
    });

    ws.on('close', () => {
        delete ws;
        initiate();
        console.log('close');
    });
}

function initiateBackTest() {
    for (k in backtestTicks) {
        main(backtestTicks[k]);
    }
}

function main(data) {
    ++count
    //console.log(count);

    tickerData.push(data.price);
    if (tickerData.length > ticks) {
        tickerData.shift();
    }

    if (tickerData.length >= 3) {
        //console.log(tickerData);

        currentIndex = tickerData.length - 1;
        lastIndex = tickerData.length - 2;

        //let momentum = parseFloat((parseFloat(tickerData[currentIndex].price) / parseFloat(tickerData[lastIndex].price)) * 100).toFixed(3);
        //momentumData.push(momentum);
        overallAvg = getArrayAvg(tickerData);
        currentState = getArrayAvg([tickerData[tickerData.length - 1], tickerData[tickerData.length - 2]]);

        // get the index of the last
        //let currentAvgsLast = currentAvgs.length - 1;
        //let overallAvgsLast = overallAvgs.length - 1;

        // then push em 
        overallAvgs.push(overallAvg);
        currentAvgs.push(currentState);

        console.log(currentState, overallAvg, currentAvgs[currentAvgs.length - 2], overallAvgs[overallAvgs.length - 2], profit, profitTarget, stopLoss, totalProfit - totalFees, orderCount, winners, losers);

        if (holdingData) {
            //profit = (tradeAmount * data.price / holdingData.price) - tradeAmount
            profit = (data.price - holdingData.price) * tradeAmountCoin;
            profitTarget = (tradeAmountCoin * holdingData.price * target);
            stopLoss = (tradeAmountCoin * holdingData.price * risk) * -1;
        } else {
            profit = 0; // reset profit
            profitTarget = 0;
            stopLoss = 0;
        }

        // crossover up now state is over, last state is under
        if (currentState > overallAvg && currentAvgs[currentAvgs.length - 2] <= overallAvgs[overallAvgs.length - 2]) {

            crossOvers.push(overallAvg);
            if (crossOvers.length > 3) {
                crossOvers.shift();
            }

            let chunk = Math.ceil(tickerData.length / 3);
            let chunkArray = [];
            j = 0;
            for (let k in tickerData) {
                let chunkIndex = Math.floor(k / chunk);
                if (!chunkArray[chunkIndex]) { chunkArray[chunkIndex] = []; }
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
            console.log('Crossing Upwards', firstAvg, secondAvg, thirdAvg);
            //console.log(currentState, overallAvg, currentAvgs[currentAvgs.length - 2], overallAvgs[overallAvgs.length - 2], profit, profitTarget, stopLoss, totalProfit - totalFees, orderCount, winners, losers);

            //if (crossOvers.length >= 2) {
            //    if (crossOvers[crossOvers.length - 1] > crossOvers[crossOvers.length - 2]) {

            if (thirdAvg > secondAvg) {
                console.log('Upward Momentum Detected');
                //mode = 'trade'

                // buy on upward crossover if no holding
                if (!holdingData) {
                    ++orderCount;
                    let fee = tradeAmountCoin * data.price * feeRate
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    console.log('BUY');
                    if (!test) {
                        fix.placeOrder('buy', 'market', tradeAmountCoin, coin[0], false)
                            .then(function (dataa, err) {
                                if (err) { console.log(err); }
                                //console.log('buy', price, dataa, err);
                                let newRow = {
                                    time: data.time,
                                    price: data.price,
                                    status: 'buy'
                                };

                                sheet.addRow(newRow, function (err) { if (err) { console.log(err); } });

                            });
                    }
                    holdingData = data;
                }
            }
            //    }
            //}

        }
        // crossover down
        else if (currentState < overallAvg && currentAvgs[currentAvgs.length - 2] >= overallAvgs[overallAvgs.length - 2]) {

            //holdingData && 
            // sell
            //crossOvers.push(overallAvg);
            console.log('Crossing Downwards');

            //tickerData = [];
            /*if (holdingData) {
                if (profit >= profitTarget) {
                    console.log('SELL')
                    totalProfit = totalProfit + profit;
                    let fee = tradeAmountCoin * data.price * feeRate
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    holdingData = false;
                    ++orderCount;
                    ++winners;
                } else if (profit <= stopLoss) {
                    console.log('SELL');
                    totalProfit = totalProfit + profit;
                    let fee = tradeAmountCoin * data.price * feeRate
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    holdingData = false;
                    ++orderCount;
                    ++losers;
                }
            }
            */


        } else {

            if (holdingData) {

                if (profit >= profitTarget) {
                    console.log('SELL')
                    totalProfit = totalProfit + profit;
                    let fee = tradeAmountCoin * data.price * feeRate
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    if (!test) {
                        fix.placeOrder('sell', 'market', tradeAmountCoin, coin[0], false)
                            .then(function (dataa, err) {
                                if (err) { console.log(err); }

                                let newRow = {
                                    time: data.time,
                                    price: data.price,
                                    status: 'sell',
                                    totalProfit: totalProfit
                                };

                                sheet.addRow(newRow, function (err) { if (err) { console.log(err); } });
                            });
                    }
                    holdingData = false;
                    ++orderCount;
                    ++winners;
                    //mode = 'observe'
                } else if (profit <= stopLoss) {
                    console.log('SELL');
                    totalProfit = totalProfit + profit;
                    let fee = tradeAmountCoin * data.price * feeRate
                    totalFees = parseFloat(totalFees) + parseFloat(fee);
                    if (!test) {
                        fix.placeOrder('sell', 'market', tradeAmountCoin, coin[0], false)
                            .then(function (dataa, err) {
                                if (err) { console.log(err); }

                                let newRow = {
                                    time: data.time,
                                    price: data.price,
                                    status: 'sell',
                                    totalProfit: totalProfit
                                };

                                sheet.addRow(newRow, function (err) { if (err) { console.log(err); } });
                            });
                    }
                    holdingData = false;
                    ++orderCount;
                    ++losers;
                    //mode = 'observe'
                } else {
                    console.log('HOLD', profit * 100 / holdingData.price);
                }


            } else {
                // no hold yet
                console.log('NO HOLDING YET');
            }

        }

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
    let wsUrl = 'wss://ws-feed.gdax.com';
    if (test) {
        secrets.gDaxApiKey = secrets.gDaxSandboxApiKey;
        secrets.gDaxApiSecret = secrets.gDaxSandboxApiSecret;
        secrets.gDaxPassphrase = secrets.gDaxSandboxPassphrase;
        wsUrl = 'wss://ws-feed-public.sandbox.gdax.com';
    }
    return new Gdax.WebsocketClient(
        coin,
        wsUrl,
        {
            key: secrets.gDaxApiKey,
            secret: secrets.gDaxApiSecret,
            passphrase: secrets.gDaxPassphrase
        },
        { channels: ['ticker'] }
    );
}