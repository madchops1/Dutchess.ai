/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "PUSS"
- Streams BTC or ETH or LTC forever
- Calculates momentum between ticks
- when we get x positive momentum reads buy in
- then wait until we get x down tick b4 selling
*/
let secrets = require('./config/secrets.json');
const async = require('async');
const moment = require('moment');
const json2csv = require('json2csv');
const sleep = require('sleep');
const args = process.argv.slice(2);

// Dutchess dependencies
const sms = require('./lib/sms.js');
const fix = require('./lib/fix.js');
const sunny = require('./lib/sunny.js');

// AWS dependencies
const AWS = require('aws-sdk');
const uuid = require('node-uuid');

// Gdax
const Gdax = require('gdax');

let test = false;
if (args[0] === 'test') { test = true; }

let tickerData = [];
let overallAvgs = [];
let currentAvgs = [];

//let momentumData = [];
let holdingData = false;
let count = 0;
let totalProfit = 0;
let profit = 0;

// Dials
let coin = ['LTC-USD'];
let currency = 'LTC';
let tradeAmount = 3000;
let tradeAmountCoin = 0.1;

// should the delay dynamically change?
let risk = 0.01;
//let riskAmount = 0;
//let usdAccountValue = 0;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;
let stopLoss = 0;
let profitTarget = 0;
let feeRate = 0.003;
let totalFees = 0;

let winners = 0;
let losers = 0;
// should I alter the risk and target based on the winner:loser ration

let orderCount = 0;
let ticks = 144;
//var buyDelay = 3; // 9
//let delay = buyDelay;
//let sellDelay = 1; // 3

//fix.getAccountValue(currency)
//    .then(function (dataa, err) {
//        if (err) { console.log(err); }
//console.log(dataa);

//   });

let currentState = 0;
let overallAvg = 0;
let crossOvers = [];
let date = moment();
//let mode = 'observe';

const ws = createWebsocket(test, coin);
ws.on('message', data => {
    //
    if (data.type === 'ticker') {
        ++count
        //console.log(count, delay);

        //if ((count % delay) == 0 || count == 1) {

        tickerData.push(data.price);
        if (tickerData.length > ticks) {
            tickerData.shift();
        }
        //console.log('TICK');


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

                console.log('Crossing Upwards', firstAvg, secondAvg, thirdAvg);

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
                        holdingData = false;
                        ++orderCount;
                        ++winners;
                        //mode = 'observe'
                    } else if (profit <= stopLoss) {
                        console.log('SELL');
                        totalProfit = totalProfit + profit;
                        let fee = tradeAmountCoin * data.price * feeRate
                        totalFees = parseFloat(totalFees) + parseFloat(fee);
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
    //}
    /*
    { type: 'ticker',
    sequence: 4986249486,
    product_id: 'BTC-USD',
    price: '9814.96000000',
    open_24h: '10966.51000000',
    volume_24h: '33184.8213776',
    low_24h: '9814.96000000',
    high_24h: '10999.00000000',
    volume_30d: '634822.83077938',
    best_bid: '9814.95',
    best_ask: '9814.96',
    side: 'buy',
    time: '2018-01-31T04:53:38.721000Z',
    trade_id: 35149878,
    last_size: '0.14198936' }
    */

});

ws.on('error', err => {
    console.log('error', err);
});

ws.on('close', () => {
    console.log('close');
});

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