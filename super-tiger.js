var secrets           = require('./secrets.json');
var async             = require('async');
var moment            = require('moment');
var json2csv          = require('json2csv');
var sleep             = require('sleep');
var args              = process.argv.slice(2);
const sms             = require('./lib/sms.js');

// AWS dependencies
var AWS               = require('aws-sdk');
var uuid              = require('node-uuid');

// Coinbase
var Client            = require('coinbase').Client;
var coinbase          = new Client({'apiKey': secrets.CoinbaseApiKey, 'apiSecret': secrets.CoinbaseApiSecret});
const Gdax            = require('gdax');
const publicClient    = new Gdax.PublicClient();

// Google Trends
var googleTrends      = require('google-trends-api');

// Google Sheets
var GoogleSpreadsheet = require('google-spreadsheet');
var sheetId           = secrets.TigerSheetId;
var doc               = new GoogleSpreadsheet(sheetId);
var creds             = require('./sheetsClientSecret.json');
var sheet;
var latestRowDate;
var missingData;
var updatedDoc;
var updatedSheet;
var csvData;
var newRows           = [];
var predDate;
var currentPrice;
var openPrice;
var lastPrice;
var lowPrice;
var highPrice;

// S3
var bucketName        = secrets.TigerBucketName;
var keyName           = 'data-' + moment().format("YYYY-MM-DD") + '.csv';

/*
// Machine Learning 
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
//wss://ws-feed.gdax.com

var priceStack = [0.0];

/*
const websocket = new Gdax.WebsocketClient(
    ['BTC-USD'],
    'wss://ws-feed.gdax.com',
    {
      key: secrets.gDaxApiKey,
      secret: secrets.gDaxApiSecret,
      passphrase: secrets.gDaxPassphrase
    },
    { channels: ['ticker'] }
  );


websocket.on('message', data => {
    //
    if(data.type === 'ticker') {
        
        priceStack.push(data.price);

        var p = parseFloat(data.price);
        var lp = parseFloat(priceStack[priceStack.length - 1]);

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
        

    }
});

websocket.on('error', err => {
    console.log('error',err);

});

websocket.on('close', () => {

});
*/