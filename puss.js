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
let tradeAmount = 3000;
let tradeAmountCoin = 0.1;
let orderCount = 0;
var buyDelay = 10; // 9
let delay = buyDelay;
let sellDelay = 1; // 3

const ws = createWebsocket(test, coin);

ws.on('message', data => {
    //
    if (data.type === 'ticker') {
        ++count
        //console.log(count, delay);

        if ((count % delay) == 0) {

            tickerData.push(data);

            if (tickerData.length >= 2) {
                //console.log(tickerData);
                currentIndex = tickerData.length - 1;
                lastIndex = tickerData.length - 2;

                let momentum = parseFloat((parseFloat(tickerData[currentIndex].price) / parseFloat(tickerData[lastIndex].price)) * 100).toFixed(3);
                momentumData.push(momentum);



                if (momentumData.length >= 3) {

                    firstIndex = momentumData.length - 1;
                    secondIndex = momentumData.length - 2;
                    thirdIndex = momentumData.length - 3;

                    tradeAmount = parseFloat(data.price) * tradeAmountCoin

                    if (holdingData) {
                        profit = (tradeAmount * data.price / holdingData.price) - tradeAmount
                    } else {
                        profit = 0;
                    }
                    fee = tradeAmountCoin * data.price * 0.00646


                    //if(momentumData[firstIndex]  > 100 &&
                    //  (momentumData[secondIndex] > 100 && momentumData[firstIndex] > momentumData[secondIndex]) && 
                    //  (momentumData[thirdIndex]  > 100 && momentumData[secondIndex]  > momentumData[thirdIndex])) {


                    //if(parseFloat(momentumData[firstIndex]) > 100 &&
                    //   parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex]) && 
                    //   parseFloat(momentumData[secondIndex]) > parseFloat(momentumData[thirdIndex])) {

                    //if(!holdingData && parseFloat(momentumData[firstIndex]) > 100 &&
                    //    parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex])) {

                    if (!holdingData &&
                        ((parseFloat(momentumData[firstIndex]) > 100 && parseFloat(momentumData[secondIndex]) > 100) ||
                            (parseFloat(momentumData[firstIndex]) > 100 && parseFloat(momentumData[firstIndex]) > parseFloat(momentumData[secondIndex])))) {
                        // handle .98 -> 100.01

                        //if(!holdingData) {
                        //console.log(':/', firstIndex, secondIndex, thirdIndex, momentumData[firstIndex], momentumData[secondIndex], momentumData[thirdIndex])
                        ++orderCount;
                        // buy holding

                        console.log('[̲̅$̲̅(̲̅' + (data.price * tradeAmountCoin).toFixed(3) + ')̲̅$̲̅]', '$' + data.price, momentum);
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

                    } else if ((holdingData && (profit > fee + 0.1)) ||
                        (holdingData && parseFloat(momentumData[firstIndex]) < 100 && profit < -0.1)) {
                        //} else if(parseFloat(momentumData[firstIndex]) < parseFloat(momentumData[secondIndex])) {

                        //if(holdingData) {
                        //console.log(':)', firstIndex, secondIndex, momentumData[firstIndex], momentumData[secondIndex])

                        // sell holding
                        //let change = data.Price - holdingData.price;

                        totalProfit = totalProfit + profit - fee;
                        //if(profit > fee) {

                        if (profit > fee + 0.1) {
                            console.log('(•◡•)', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
                        } else {
                            console.log('(ಠ_ಠ)', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
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
                    } else if (holdingData && (profit <= fee + 0.1)) {
                        if (momentum > 100) {
                            console.log(':)', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
                        } else if (momentum === 100) {
                            console.log(':|', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
                        } else if (momentum < 100) {
                            console.log(':(', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
                        }
                    } else {
                        console.log('¯_(ツ)_/¯', '$' + data.price, momentum, '$' + holdingData.price, profit, fee, totalProfit, orderCount)
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