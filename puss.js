/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "PUSS"
- Streams BTC or ETH or LTC forever
- Calculates momentum between ticks
- when we get x positive momentum reads buy in
- then wait until we get x down tick b4 selling

forever start -o ~/Dutchess.ai/.tmp/puss.out.log -e ~/Dutchess.ai/.tmp/puss.err.log puss.js
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

// AWS dependencies
const AWS = require('aws-sdk');
const uuid = require('node-uuid');

// Gdax
const Gdax = require('gdax');

let test = false;
if (args[0] === 'test') { test = true; }

let tickerData = [];
let momentumData = [];
let holdingData = false;
let count = 0;
let totalProfit = 0;
let profit = 0;

// Dials
let coin = ['LTC-USD'];
let currency = 'LTC';
let tradeAmount = 0;
let tradeAmountCoin = 0.1;

// should the delay dynamically change?
let risk = .01;
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
var buyDelay = 3; // 9
let delay = buyDelay;
let sellDelay = 1; // 3

//fix.getAccountValue(currency)
//    .then(function (dataa, err) {
//        if (err) { console.log(err); }
//console.log(dataa);

//   });



const ws = createWebsocket(test, coin);
ws.on('message', data => {
    //
    if (data.type === 'ticker') {
        ++count
        //console.log(count, delay);

        if ((count % delay) == 0 || count == 1) {

            tickerData.push(data);

            if (tickerData.length >= 2) {

                currentIndex = tickerData.length - 1;
                lastIndex = tickerData.length - 2;

                let momentum = parseFloat((parseFloat(tickerData[currentIndex].price) / parseFloat(tickerData[lastIndex].price)) * 100).toFixed(3);
                momentumData.push(momentum);

                if (momentumData.length >= 2) {

                    firstIndex = momentumData.length - 1;
                    secondIndex = momentumData.length - 2;
                    //thirdIndex = momentumData.length - 3;

                    tradeAmount = parseFloat(data.price) * tradeAmountCoin

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

                    //console.log('ALPHA', tradeAmount, profit, profitTarget, stopLoss)
                    //process.exit(1);




                    //if(momentumData[firstIndex]  > 100 &&
                    //  (momentumData[secondIndex] > 100 && momentumData[firstIndex] > momentumData[secondIndex]) && 
                    //  (momentumData[thirdIndex]  > 100 && momentumData[secondIndex]  > momentumData[thirdIndex])) {


                    //if(parseFloat(momentumData[firstIndex]) > 100 &&
                    //   parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex]) && 
                    //   parseFloat(momentumData[secondIndex]) > parseFloat(momentumData[thirdIndex])) {

                    //if(!holdingData && parseFloat(momentumData[firstIndex]) > 100 &&
                    //    parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex])) {

                    //if (!holdingData &&
                    //    ((parseFloat(momentumData[firstIndex]) > 100 && parseFloat(momentumData[secondIndex]) > 100) ||
                    //        (parseFloat(momentumData[firstIndex]) > 100 && parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex])))) {

                    if (!holdingData &&
                        ((parseFloat(momentumData[firstIndex]) > 100 && parseFloat(momentumData[secondIndex]) > 100) ||
                            (parseFloat(momentumData[firstIndex]) > 100))) {

                        // handle .98 -> 100.01

                        //if(!holdingData) {
                        //console.log(':/', firstIndex, secondIndex, thirdIndex, momentumData[firstIndex], momentumData[secondIndex], momentumData[thirdIndex])
                        ++orderCount;
                        // buy holding
                        fee = tradeAmountCoin * data.price * feeRate
                        totalFees = parseFloat(totalFees) + parseFloat(fee);
                        //console.log('FEE', fee);
                        //process.exit(1);

                        console.log('[̲̅$̲̅(̲̅' + (data.price * tradeAmountCoin).toFixed(3) + ')̲̅$̲̅]', '$' + data.price, momentum, '$' + fee);
                        //let price = parseFloat(((parseFloat(data.price) * 0.1) / 1) + .1).toFixed(2);
                        //fix.placeOrder('buy', 'limit', 0.1, 'LTC-USD', false, price)
                        fix.placeOrder('buy', 'market', tradeAmountCoin, 'LTC-USD', false)
                            .then(function (dataa, err) {
                                if (err) { console.log(err); }
                                //console.log('buy', price, dataa, err);

                            });
                        holdingData = data;
                        delay = sellDelay;
                        //}

                        //} else if(momentumData[firstIndex] < 100 && momentumData[secondIndex] < 100) {
                        //} else if(parseFloat(momentumData[firstIndex]) < 100 &&
                        //          parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex]) &&
                        //         parseFloat(momentumData[secondIndex]) < parseFloat(momentumData[thirdIndex])) {

                        //} else if(parseFloat(data.price) <= holdingData.price &&
                        //          parseFloat(momentumData[firstIndex]) <= 100 &&
                        //          parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex])) {

                        //} else if(parseFloat(momentumData[firstIndex]) <= 100 &&
                        //          parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex]) &&
                        //          parseFloat(momentumData[secondIndex]) < parseFloat(momentumData[thirdIndex])) {

                        //} else if((parseFloat(data.price) < holdingData.price && parseFloat(momentumData[firstIndex]) < 100 ) || 
                        //          (parseFloat(momentumData[firstIndex]) <= 100 &&
                        //           parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex]) &&
                        //           parseFloat(momentumData[secondIndex]) < parseFloat(momentumData[thirdIndex]))) {

                        //} else if((parseFloat(data.price) < holdingData.price && parseFloat(momentumData[firstIndex]) < 100 ) || 
                        //          //(parseFloat(momentumData[firstIndex]) == 100 && parseFloat(momentumData[secondIndex]) == 100) ||
                        //          (parseFloat(momentumData[firstIndex]) <= 100 &&
                        //           parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex]) &&
                        //           parseFloat(momentumData[secondIndex]) < parseFloat(momentumData[thirdIndex]))) {

                    } else if ((holdingData && (profit >= profitTarget)) ||
                        (holdingData && parseFloat(momentumData[firstIndex]) < 100 && profit <= stopLoss)) {
                        //} else if(parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex])) {

                        //if(holdingData) {
                        //console.log(':)', firstIndex, secondIndex, momentumData[firstIndex], momentumData[secondIndex])

                        // sell holding
                        //let change = data.Price - holdingData.price;

                        totalProfit = totalProfit + profit;
                        fee = tradeAmountCoin * data.price * feeRate
                        totalFees = parseFloat(totalFees) + parseFloat(fee);
                        ++orderCount;
                        //if(profit > fee) {

                        if (profit >= profitTarget) {
                            ++winners
                            //console.log('(•◡•)', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalFees, totalProfit, orderCount, winners, losers)
                            console.log('SELL (•◡•)', data.price, profit, fee);
                        } else {
                            ++losers
                            console.log('SELL (ಠ_ಠ)', data.price, profit, fee);
                            //console.log('', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalFees, totalProfit, orderCount, winners, losers)
                        }
                        //console.log('Sell', data.price, holdingData.price, profit, fee, totalProfit, orderCount);
                        //let price = parseFloat(((parseFloat(data.price) * 0.1) / 1) - .2).toFixed(2);
                        //fix.placeOrder('sell', 'limit', 0.1, 'LTC-USD', false, price)
                        fix.placeOrder('sell', 'market', tradeAmountCoin, 'LTC-USD', false)
                            .then(function (dataa, err) {
                                if (err) { console.log(err); }
                                //console.log('sell', dataa, err);
                            });
                        holdingData = false;
                        delay = buyDelay;
                        //} else {
                        //    console.log(':/ Dont Sell', profit, fee);
                        //}
                        //}
                    } else if (holdingData && (profit < profitTarget)) {
                        if (momentum > 100) {
                            //console.log(':)', momentum, '$' + data.price.toFixed(2),'$' + holdingData.price, stopLoss, profitTarget, profit, totalFees, totalProfit - totalFees, orderCount, winners, losers)
                            console.log(':)', momentum, '$' + data.price, '$' + holdingData.price, profit, stopLoss, profitTarget, totalProfit - totalFees, orderCount, winners, losers)
                        } else if (momentum === 100) {
                            //console.log(':|', '$' + data.price, momentum, '$' + holdingData.price, stopLoss, profitTarget, profit, totalFees, totalProfit - totalFees, orderCount, winners, losers)
                            console.log(':|', momentum, '$' + data.price, '$' + holdingData.price, profit, stopLoss, profitTarget, totalProfit - totalFees, orderCount, winners, losers)

                        } else if (momentum < 100) {
                            //console.log(':(', '$' + data.price, momentum, '$' + holdingData.price, stopLoss, profitTarget, profit, totalFees, totalProfit - totalFees, orderCount, winners, losers)
                            console.log(':(', momentum, '$' + data.price, '$' + holdingData.price, profit, stopLoss, profitTarget, totalProfit - totalFees, orderCount, winners, losers)

                        }
                    } else {
                        console.log('¯_(ツ)_/¯', momentum, '$' + data.price, '$' + holdingData.price)
                    }
                }
            }
        }
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


    }
});

ws.on('error', err => {
    console.log('error', err);
});

ws.on('close', () => {
    console.log('close');
});

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