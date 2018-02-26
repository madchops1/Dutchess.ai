/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "RANDY"
RSI breakout trader

NOTES:

    Currently running daily in production
    .1 = 10 / 100
    run mon-fri @ 9am CST
    If below 30 when was above 30 then buy
    If above 70 when was below 70 then sell

*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const args = process.argv.slice(2);
const sms = require(constants.LIB + '/sms.js');
const fix = require(constants.LIB + '/fix.js');
const scraperjs = require('scraperjs');
const sleep = require('sleep');
const GoogleSpreadsheet = require('google-spreadsheet');
const sheetId = secrets.RandySheetId;
const AWS = require('aws-sdk');
const uuid = require('node-uuid');
const Gdax = require('gdax');
const async = require('async');

let doc = new GoogleSpreadsheet(sheetId);
let creds = require(constants.CONFIG + '/sheetsClientSecret.json');

let test = false;
if (args[0] === 'test') { test = true; }

let apiURI = 'https://api.gdax.com';
let apiSandboxURI = 'https://api-public.sandbox.gdax.com';
let rsiData = {};
let lastRsiData = {};
let tickerData = {};
let sheet;
let status = '';

// Dials
let coin = 'LTC-USD';
let currency = 'LTC';
let tradeAmountCoin = 0.1;

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

    // Step 3 Get RSI
    function getRSI(step) {
        scraperjs.StaticScraper.create('https://www.marketvolume.com/stocks/relativestrengthindexrsi.asp?s=LTC&t=ltc-properties')
            .scrape(function ($) {
                return $('#calm > div.container > table > tbody > tr:nth-child(1) > td:nth-child(6)').map(function () {
                    return $(this).text();
                }).get();
            })
            .then(function (text) {
                rsiData = text[0];
                console.log('Step 3: Get RSI Successful, ' + rsiData);
                step();
            });
    },

    // Step 4 Get last RSI data
    function getLastRSI(step) {
        scraperjs.StaticScraper.create('https://www.marketvolume.com/stocks/relativestrengthindexrsi.asp?s=LTC&t=ltc-properties')
            .scrape(function ($) {
                return $('#calm > div.container > table > tbody > tr:nth-child(2) > td:nth-child(6)').map(function () {
                    return $(this).text();
                }).get();
            })
            .then(function (text) {
                lastRsiData = text[0];
                console.log('Step 4: Get last RSI Successful, ' + lastRsiData);
                step();
            });
    },

    // Step 5 Get ticker data
    function getTicker(step) {
        var client = authedClient(test);
        client.getProductTicker(coin, (error, response, data) => {
            tickerData = data;
            console.log('Step 5: Get Ticker Data Successful, price: ' + tickerData.price);
            step();
        });
    },

    // Step 6 Buy, Sell, None
    function trade(step) {

        // buy
        if (rsiData < 30 && lastRsiData >= 30) {
            fix.placeOrder('buy', 'market', tradeAmountCoin, coin, false)
                .then(function (dataa, err) {
                    if (err) { console.log(err); }
                    //console.log('buy', price, dataa, err);
                    console.log('Step 6: Trade: Buy');
                    status = 'buy'
                    step();
                });
        }

        // sell
        else if (rsiData > 70 && lastRsiData <= 70) {
            fix.placeOrder('sell', 'market', tradeAmountCoin, coin, false)
                .then(function (dataa, err) {
                    if (err) { console.log(err); }
                    //console.log('buy', price, dataa, err);
                    console.log('Step 6: Trade: Sell');
                    status = 'sell'
                    step();
                });
        }

        // none
        else {
            console.log('Step 6: Trade: None');
            status = 'none'
            step();

        }
    },

    // Step 7 Log
    function addRow(step) {
        let newRow = {
            time: tickerData.time,
            price: tickerData.price,
            lastRsi: lastRsiData,
            rsi: rsiData,
            status: status
        };

        sheet.addRow(newRow,
            function (err) {
                if (err) { console.log(err); }
                console.log('Step 7: Log');
                step();
            });
    }

],
    function (err) {
        if (err) {
            console.log('Error: ' + err);
        }
    }
);

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

function getArrayAvg(elmt) {
    var sum = 0;
    for (var i = 0; i < elmt.length; i++) {
        sum += parseFloat(elmt[i]); //don't forget to add the base
    }
    var avg = sum / elmt.length;
    //console.log('AVG', avg)
    return avg;
}
