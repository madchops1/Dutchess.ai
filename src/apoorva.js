/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "Apoorva"

1. calculate 5 day sma
2. calculate 20 day sma
3, Take a long position when the 5 day SMA is larger than or equal to 20 day SMA
4. Sell when the 5 day SMA is smaller than 20 day SMA

NOTES:
close prices are last of the 24 hour day
run daily at 1am
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

let trainingDoc = new GoogleSpreadsheet(trainingSheetId);
let trainingSheet;
let creds = require(constants.CONFIG + '/sheetsClientSecret.json');
let machineLearning = false;
let coin = ['LTC-USD'];
let fiveDayMovingAverage;
let twentyDayMovingAverage;
let dataStore;
let ticker;

// Dials
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;

function getDataStore() {
    return new Promise(function(resolve, reject) {
        returnJsonFileObject(constants.TMP + '/apoorva/dataStore.json').then(function(data, err) {
            if (err) {
                reject(err);
            }
            dataStore = data;
            resolve();
        });
    });
}

function setDataStore(newDataStore) {
    return new Promise(function(resolve, reject) {
        body = JSON.stringify(newDataStore);
        fs.writeFile(constants.TMP + '/apoorva/dataStore.json', body, 'utf8', function(err, data) {
            if (err) {
                console.log(err);
            }
            resolve();
        });
    });
}

function returnJsonFileObject(file) {
    return new Promise(function(resolve, reject) {
        fs.readFile(file, function read(err, data) {
            if (err) {
                reject(err);
            }
            data = JSON.parse(data);
            resolve(data);
        });
    });
}

function configApis() {
    return new Promise(function(resolve, reject) {
        GdaxClient = authedClient();
        trainingDoc.useServiceAccountAuth(creds, function(data) {
            resolve();
        });
    });
}

function getTrainingWorksheet() {
    return new Promise(function(resolve, reject) {
        trainingDoc.getInfo(function(err, info) {
            if (err) {
                console.log(err);
                reject(err);
            }
            trainingSheet = info.worksheets[0];
            console.log('Got Training Sheet');
            resolve();
        });
    });
}

function getFiveDayMovingAverage() {
    return new Promise(function(resolve, reject) {
        GdaxClient.getProductHistoricRates(
            coin[0],
            {
                start: moment()
                    .subtract(6, 'days')
                    .format('YYYY-MM-DD'),
                end: moment()
                    .subtract(1, 'days')
                    .format('YYYY-MM-DD'),
                granularity: 86400
            },
            function(err, data, response) {
                let lastTotal = 0;
                for (let i = 0; i < response.length; i++) {
                    lastTotal = lastTotal + response[i][4];
                }
                fiveDayMovingAverage = lastTotal / 5;
                console.log('fiveDayMovingAverage', fiveDayMovingAverage);
                resolve();
            }
        );
    });
}

function getTwentyDayMovingAverage() {
    return new Promise(function(resolve, reject) {
        GdaxClient.getProductHistoricRates(
            coin[0],
            {
                start: moment()
                    .subtract(21, 'days')
                    .format('YYYY-MM-DD'),
                end: moment()
                    .subtract(1, 'days')
                    .format('YYYY-MM-DD'),
                granularity: 86400
            },
            function(err, data, response) {
                let lastTotal = 0;
                for (let i = 0; i < response.length; i++) {
                    lastTotal = lastTotal + response[i][4];
                }
                twentyDayMovingAverage = lastTotal / 20;
                console.log('twentyDayMovingAverage', twentyDayMovingAverage);
                resolve();
            }
        );
    });
}

function authedClient() {
    console.log('Config Gdax');
    return new Gdax.AuthenticatedClient(secrets.gDaxApiKey, secrets.gDaxApiSecret, secrets.gDaxPassphrase, apiURI);
}

function getTicker() {
    return new Promise(function(resolve, reject) {
        GdaxClient.getProductTicker(coin[0], function(err, data, response) {
            if (err) {
                console.log(err);
                reject(err);
            }
            ticker = response;
            resolve();
        });
    });
}

function trader() {
    return new Promise(function(resolve, data) {
        //console.log('holdingData', dataStore.holdingData);
        if (fiveDayMovingAverage >= twentyDayMovingAverage) {
            if (!dataStore.holdingData) {
                //console.log('Buy', dataStore.holdingData);
                //resolve();
                // Buy
                fix.placeOrder('buy', 'market', tradeAmountCoin, coin[0], false).then(function(data, err) {
                    if (err) {
                        console.log(err);
                        reject();
                    }

                    dataStore.holdingData = ticker;
                    dataStore.holdingData.date = moment().format('YYYY-MM-DD');
                    dataStore.holdingData.time = moment().format('hh:mm A');
                    dataStore.holdingData.fiveDayMovingAverage = fiveDayMovingAverage;
                    dataStore.holdingData.twentyDayMovingAverage = twentyDayMovingAverage;

                    setDataStore(dataStore)
                        .then(function(data) {
                            console.log('Buy', ticker);
                            resolve();
                        })
                        .catch(function(err) {
                            console.log(err);
                            reject(err);
                        });
                });
            } else {
                console.log('Continue Holding', dtaaStore.holdingData);
            }
        } else if (fiveDayMovingAverage < twentyDayMovingAverage) {
            if (dataStore.holdingData) {
                //console.log('Sell', dataStore.holdingData);
                //resolve();
                // Sell
                fix.placeOrder('sell', 'market', tradeAmountCoin, coin[0], false).then(function(data, err) {
                    if (err) {
                        console.log(err);
                        reject();
                    }

                    let status;
                    if (ticker.price > dataStore.holdingData.price) {
                        status = 1;
                    } else {
                        status = 0;
                    }

                    // Train
                    let newTrainingRow = {
                        date: dataStore.holdingData.date,
                        time: dataStore.holdingData.time,
                        fiveDayMovingAverage: dataStore.holdingData.fiveDayMovingAverage,
                        twentyDayMovingAverage: dataStore.holdingData.twentyDayMovingAverage,
                        price: dataStore.holdingData.price,
                        volume: dataStore.holdingData.volume,
                        status: status
                    };
                    trainingSheet.addRow(newTrainingRow, function(err) {
                        if (err) {
                            console.log(err);
                            reject();
                        }
                        // Wipe holding data
                        dataStore.holdingData = false;
                        setDataStore(dataStore)
                            .then(function(data) {
                                console.log('Sell', ticker);
                                resolve();
                            })
                            .catch(function(err) {
                                console.log(err);
                                reject(err);
                            });
                    });
                });
            } else {
                console.log('Not Holding Yet');
            }
        }
    });
}

async.series(
    [
        // getDataStore
        function(callback) {
            getDataStore()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },

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

        // config Training Sheet
        function(callback) {
            getTrainingWorksheet()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },

        // get 5 day MVA
        function(callback) {
            getFiveDayMovingAverage()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },

        // get 20 day MVA
        function(callback) {
            getTwentyDayMovingAverage()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },

        // ticker
        function(callback) {
            getTicker()
                .then(function(data) {
                    callback();
                })
                .catch(function(err) {
                    console.log(err);
                });
        },

        // trader
        function(callback) {
            trader()
                .then(function(data) {
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
