let secrets             = require('./config/secrets.json');
const async             = require('async');
const moment            = require('moment');
const json2csv          = require('json2csv');
const sleep             = require('sleep');
const args              = process.argv.slice(2);

// Dutchess dependencies
const sms               = require('./lib/sms.js');
const fix               = require('./lib/fix.js');

// AWS dependencies
const AWS               = require('aws-sdk');
const uuid              = require('node-uuid');

// Google trends
const googleTrends      = require('google-trends-api');

// Gdax
const Gdax              = require('gdax');

let test = false;
if(args[0] === 'test') { test = true; }


// Machine Learning 
const sagemaker = new AWS.SageMaker();
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

function createWebsocket(test) {

    let wsUrl = 'wss://ws-feed.gdax.com';

    if(test) {
        secrets.gDaxApiKey = secrets.gDaxSandboxApiKey;
        secrets.gDaxApiSecret = secrets.gDaxSandboxApiSecret;
        secrets.gDaxPassphrase = secrets.gDaxSandboxPassphrase;
        wsUrl = 'wss://ws-feed-public.sandbox.gdax.com';
    }

    return new Gdax.WebsocketClient(
        ['BTC-USD'],
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
const ws = createWebsocket(test);

var params = {
    NotebookInstanceName: 'STRING_VALUE', /* required */
    SessionExpirationDurationInSeconds: 0
};

sagemaker.createPresignedNotebookInstanceUrl(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
});

ws.on('message', data => {
    //
    if(data.type === 'ticker') {

        let time = moment(data.time);

        json.push({"start":time.format("YYYY-MM-DD HH:mm:ss"), "target": [data.price, data.volume_24h, data.low_24h, data.high_24h, data.last_size], "cat": 0});
        // {"start":"1999-01-30 00:00:00", "target": [2.0, 1.0], "cat": 0}
        console.log(json);
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

ws.on('error', err => {
    console.log('error',err);

});

ws.on('close', () => {

});
