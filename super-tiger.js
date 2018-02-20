/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "SUPER TIGER"
- Rotating Momentum Trader...
- Streams BTC, ETH, LTC forever
- Calculates momentum for each using rate of change between tick + delay
- Determines leader
- Buys x amount of the leader
- Sells all of current position
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

// Google trends
const googleTrends = require('google-trends-api');

// Gdax
const Gdax = require('gdax');

let test = false;
if (args[0] === 'test') { test = true; }

// Machine Learning 
//const sagemaker = new AWS.SageMaker();
/*
var mL                = new AWS.MachineLearning({'region': 'us-east-1'});
var trainingDatasourceId;
var evaluationDatasourceId;
var modelId;
var evaluationId;
var predictionEndpoint;
var prediction;
var predictionScore;
var predictionDirection;
var predictionPosition;
*/

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

let priceStack = [0.0];
let json = [];
const wsBtc = createWebsocket(test, ['BTC-USD']);
const wsEth = createWebsocket(test, ['ETH-USD']);
const wsLtc = createWebsocket(test, ['LTC-USD']);

var params = {
    NotebookInstanceName: 'Dutchess-Tiger-Sage',
    SessionExpirationDurationInSeconds: 0
};

/*
sagemaker.createPresignedNotebookInstanceUrl(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
});
*/
let btc = false;
let eth = false;
let ltc = false;

let lastBtc = false;
let lastEth = false;
let lastLtc = false;

let btcM = 100;
let ethM = 100;
let ltcM = 100;

let leader = '';
let lastLeader = false;
let fee = 0.3;
let holding = false;
let lastHolding = false;
let holdingChange = 0;
let totalProfit = 0;

let bT = 0
let eT = 0
let lT = 0

let delay = 20
let tradeAmount = 2000;
let orderCount = 0;

let dots = '';

function momentumLeader() {

    //console.log(btcM, ethM, ltcM);

    let mArray = [
        { coin: "BTC-USD", value: parseFloat(btcM) },
        { coin: "ETH-USD", value: parseFloat(ethM) },
        { coin: "LTC-USD", value: parseFloat(ltcM) }];

    if (btcM !== ethM && btcM !== ltcM) {

        mArray = mArray.sort(function (a, b) {
            return b.value - a.value;
        });
        //console.log(mArray);
        lastLeader = leader;
        leader = mArray[0].coin;
        //if(mArray[0].value > 100) {
        placeOrder();
        //}
    }
}

function placeOrder() {

    if (lastLeader && leader !== lastLeader) {


        lastHolding = holding;

        if (leader == 'BTC-USD') {
            //console.log(btc);
            holding = btc;
        } else if (leader == 'LTC-USD') {
            //console.log(ltc);
            holding = ltc;
        } else if (leader == 'ETH-USD') {
            //console.log(eth);
            holding = eth;
        }



        let diff = 0;

        if (lastLeader == 'BTC-USD') {
            diff = btc.price - lastHolding.price;
        } else if (lastLeader == 'ETH-USD') {
            //console.log(ltc);
            diff = eth.price - lastHolding.price;
        } else if (lastLeader == 'LTC-USD') {
            //console.log(eth);
            diff = ltc.price - lastHolding.price;
        }

        let lastHoldingPercentage = tradeAmount / lastHolding.price
        let profit = diff * lastHoldingPercentage;
        if (!isNaN(profit)) {
            totalProfit = (parseFloat(totalProfit) + parseFloat(profit));
        }
        ++orderCount;

        let log = {
            leader: leader,
            LbuyPrice: holding.price,
            lastLeader: lastLeader,
            LLbuyPrice: lastHolding.price,
            profit: profit,
            totalProfit: totalProfit,
            orderCount: orderCount,
            diff: diff,
            btc: btc.price,
            eth: eth.price,
            ltc: ltc.price
        };
        console.log(log);
        //console.log('placeOrder', leader, holding.price, lastLeader, lastHolding.price, '|', profit, '|', totalProfit + '|', diff, btc.price, eth.price, ltc.price); //, holding, lastLeader, lastHolding);


    } else {
        console.log('Let it ride...', 'LST:' + lastLeader, 'LDR:' + leader)
    }

}

wsBtc.on('message', data => {
    //
    if (data.type === 'ticker') {

        ++bT;

        //process.stdout.write(dots+bT+'\r');
        dots += '.';

        if ((bT % delay) == 0 || bT < 3 || bT == (delay + 1)) {
            dots = '';
            btc = data;
            if (lastBtc) {
                btcM = parseFloat((parseFloat(data.price) / parseFloat(lastBtc.price)) * 100).toFixed(2);
                console.log('Btc:', btcM, parseFloat(data.price));
                if (btcM >= 100) {
                    momentumLeader();
                }

            }

            lastBtc = data;
        }
        /*
         
        let time = moment(data.time)

        let obj = { 
            "start":time.format("YYYY-MM-DD HH:mm:ss"), 
            "target": [data.price, data.volume_24h, data.low_24h, data.high_24h, data.last_size],
            "cat": 0
        }
         */

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



        /*
        //priceStack.push(data.price);

        var p = parseFloat(data.price);
        var lp = parseFloat(priceStack[priceStack.length - 2]);

        if(lp < p) {
            console.log('Upwards');
        } else if (lp === p) {
            console.log('Same');
        } else {
            console.log('Downwards');
        }

        console.log('Prediction:')
        console.log('data',data, p, lp);
        console.log('');
        */


    }
});


wsEth.on('message', data => {
    //
    if (data.type === 'ticker') {

        ++eT;
        //process.stdout.write(dots+bT+'\r');
        dots += '.';

        if ((eT % delay) == 0 || eT < 3 || eT == (delay + 1)) {
            dots = '';
            eth = data;
            if (lastEth) {
                ethM = parseFloat((parseFloat(data.price) / parseFloat(lastEth.price)) * 100).toFixed(2);
                console.log('Eth:', ethM, parseFloat(data.price));
                if (ethM >= 100) {
                    momentumLeader();
                }
            }

            lastEth = data;
            //console.log(data);
        }

    }
});



wsLtc.on('message', data => {
    //
    if (data.type === 'ticker') {

        ++lT;
        //process.stdout.write(dots+bT+'\r');
        dots += '.';

        if ((lT % delay) == 0 || lT < 3 || lT == (delay + 1)) {
            dots = '';
            //console.log('lT',lT,lT/20,(lT%delay));

            //console.log(data);
            ltc = data;
            if (lastLtc) {
                ltcM = parseFloat((parseFloat(data.price) / parseFloat(lastLtc.price)) * 100).toFixed(2);
                console.log('LTC:', ltcM, parseFloat(data.price));
                if (ltcM >= 100) {
                    momentumLeader();
                }
            }

            lastLtc = data;
        }

    }
});


wsBtc.on('error', err => {
    console.log('error', err);

});

wsBtc.on('close', () => {

});

wsEth.on('error', err => {
    console.log('error', err);

});

wsEth.on('close', () => {

});

wsLtc.on('error', err => {
    console.log('error', err);

});

wsLtc.on('close', () => {

});
