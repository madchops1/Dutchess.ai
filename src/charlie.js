/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "Charlie"

Order Book 

Is the news positive
Is the price momentum up using a 5 day vs 20 day sma



*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const args = process.argv.slice(2);
const sms = require(constants.LIB + '/sms.js');
const fix = require(constants.LIB + '/fix.js');
const AWS = require('aws-sdk');
const uuid = require('node-uuid');
const Gdax = require('gdax');
const GoogleSpreadsheet = require('google-spreadsheet');
const trainingSheetId = secrets.ApoorvaTrainingSheetId;
const async = require('async');
const fs = require('fs');
const mL = new AWS.MachineLearning({ region: 'us-east-1' });
const shell = require('shelljs');
const apiURI = 'https://api.gdax.com';
const vibeNews = require(constants.LIB + '/vibeNews.js');
const vibeTweets = require(constants.LIB + '/vibeTweets.js');

// Dials
let coin = ['LTC-USD'];

function getOrderBook() {
    return new Promise(function(resolve, reject) {
        GdaxClient.getProductOrderBook(coin[0], { level: 2 }, (error, response, book) => {
            if (error) {
                console.log(err);
                reject(err);
            }
            //console.log('BOOK', book);
            resolve(book);
        });
    });
}

function authedClient() {
    console.log('Config Gdax');
    return new Gdax.AuthenticatedClient(secrets.gDaxApiKey, secrets.gDaxApiSecret, secrets.gDaxPassphrase, apiURI);
}

function configApis() {
    return new Promise(function(resolve, reject) {
        GdaxClient = authedClient();
        resolve();
        //trainingDoc.useServiceAccountAuth(creds, function(data) {
        //    resolve();
        //});
    });
}

async.series(
    [
        // config APIs
        function(callback) {
            configApis()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },
        function(callback) {
            getOrderBook()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },
        function(callback) {
            vibeNews
                .vibeNews('litecoin')
                .then(function(data) {
                    console.log(data);
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },
        function(callback) {
            vibeTweets
                .vibeTweets('litecoin')
                .then(function(data) {
                    console.log(data);
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        }
    ],
    function(err) {
        if (err) {
            console.log('Error: ' + err);
        }
    }
);
