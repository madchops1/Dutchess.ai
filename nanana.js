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
let risk = 0.005;
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


const ws = createWebsocket(test, coin);
ws.on('message', data => {
    //
    if (data.type === 'ticker') {
        ++count
        //console.log(count, delay);

        //if ((count % delay) == 0 || count == 1) {

        tickerData.push(data.price);
        //console.log('TICK');


        if (tickerData.length >= 3) {
            //console.log(tickerData);

            currentIndex = tickerData.length - 1;
            lastIndex = tickerData.length - 2;

            //let momentum = parseFloat((parseFloat(tickerData[currentIndex].price) / parseFloat(tickerData[lastIndex].price)) * 100).toFixed(3);
            //momentumData.push(momentum);
            overallAvg = getArrayAvg(tickerData);
            currentState = getArrayAvg([tickerData[currentIndex], tickerData[lastIndex]]);

            let currentAvgsLast = currentAvgs.length - 1;
            let overallAvgsLast = overallAvgs.length - 1;


            overallAvgs.push(overallAvg);
            currentAvgs.push(currentState);


            console.log(currentState, overallAvg, currentAvgs[currentAvgsLast], overallAvgs[overallAvgsLast]);

            // crossover up now state is over, last state is under
            if (!holdingData && currentState > overallAvg && currentAvgs[currentAvgsLast] <= overallAvgs[overallAvgsLast]) {
                //buy
                holdingData = data.price;
                console.log('BUY', data.price);

            }
            // crossover down
            else if (holdingData && currentState < overallAvg && currentAvgs[currentAvgsLast] >= overallAvgs[overallAvgsLast]) {
                // sell
                console.log('SELL', holdingData, data.price);
                holdingData = false;
                tickerData = [];


            } else if (holdingData) {
                //if (holdingData) {
                // hold
                console.log('HOLD');

            } else if (!holdingData) {
                // moving down waiting for up
                console.log('NO HOLDING YET');
                //if(currentState < overallAvg)

                //}
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