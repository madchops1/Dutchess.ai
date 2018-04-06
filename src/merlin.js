/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "Merlin"
Mean Revision Strategy

- runs forever
- first identify the trading range for today
- then compute the average price / mean
- use the last 20 ticks to calculate standard deviation
- if the price is below the mean and standard deviation is greater that 0 then buy
- sell at stoploss or target profit

Logs to .tmp/merlin/...
*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const fix = require(constants.LIB + '/fix.js');
const Gdax = require('gdax');
const async = require('async');
const apiURI = 'https://api.gdax.com';
const GoogleSpreadsheet = require('google-spreadsheet');
const trainingSheetId = secrets.MerlinTrainingSheetId;

let trainingDoc = new GoogleSpreadsheet(trainingSheetId);
let trainingSheet;
let creds = require(constants.CONFIG + '/sheetsClientSecret.json');
let mean = 0;
let stats = false;
let shortMean = 0;
let tickerData = [];
let standardDeviation = 0;
let holdingData = false;
let profit = 0;
let profitTarget = 0;
let stopLoss = 0;
let totalProfit = 0;
let winners = 0;
let losers = 0;
let feeRate = 0.003;
let totalFees = 0;

// Dials
let coin = ['LTC-USD'];
let ticks = 20;
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 3; // 3:risk
let target = risk * targetRatio;

function configApi() {
    return new Promise(function(resolve, reject) {
        GdaxClient = authedClient();
        trainingDoc.useServiceAccountAuth(creds, function() {
            resolve();
        });
    });
}

function authedClient() {
    console.log('Config Gdax');
    return new Gdax.AuthenticatedClient(secrets.gDaxApiKey, secrets.gDaxApiSecret, secrets.gDaxPassphrase, apiURI);
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

function createWebsocket(coin) {
    let wsUrl = 'wss://ws-feed.gdax.com';
    console.log('Websocket Established');
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

function initiateWebSocket() {
    let ws = createWebsocket(coin);
    ws.on('message', data => {
        if (data.type === 'ticker') {
            main(data);
        }
    });

    ws.on('error', err => {
        console.log('error', err);
    });

    ws.on('close', () => {
        delete ws;
        initiateWebSocket();
        console.log('close');
    });
}

function getTradingRangeMean() {
    return new Promise(function(resolve, reject) {
        GdaxClient.getProduct24HrStats(coin[0], function(err, data, response) {
            if (err) {
                console.log(err);
                reject(err);
            }
            //console.log(data, response);
            stats = response;
            mean = (parseFloat(response.high) + parseFloat(response.low)) / 2;
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), "Today's Mean", mean);
            resolve(mean);
        });
    });
}

function getShortMean() {
    for (i = 0; i <= tickerData.length; i++) {
        shortMean = shortMean + tickerData[i];
    }
    shortMean = shortMean / (tickerData.length - 1);
    return shortMean;
}

function pushTickerData(data) {
    if (data && typeof data.price != 'undefined') {
        //console.log('Push Ticker Data', count, data.price);
        tickerData.push(data.price);
        if (tickerData.length > ticks) {
            tickerData.shift();
        }
    }
}

function getStandardDeviation() {
    let squaredDifferences = [];
    let dif;
    let square;
    for (i = 0; i < tickerData.length; i++) {
        dif = tickerData[i] - shortMean;
        square = dif * dif;
        squaredDifferences.push(square);
        //console.log(dif, square);
    }

    let sum = 0;
    for (i = 0; i < squaredDifferences.length; i++) {
        sum = sum + squaredDifferences[i];
    }

    let squaredDifferencesMean = sum / (tickerData.length - 1);
    console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Standard Deviation', standardDeviation);
    standardDeviation = Math.sqrt(squaredDifferencesMean);
}

function buy(data) {
    return new Promise(function(resolve, reject) {
        price = data.price;
        fix.placeOrder('buy', 'market', tradeAmountCoin, coin[0], false).then(function(dat, err) {
            if (err) {
                console.log(err);
                reject(err);
            }
            let fee = tradeAmountCoin * price * feeRate;
            totalFees = parseFloat(totalFees) + parseFloat(fee);
            holdingData = data;
            holdingData.date = moment().format('MM/DD/YYYY');
            holdingData.time = moment().format('hh:mm A');
            holdingData.standardDeviation = standardDeviation;
            holdingData.high = stats.high;
            holdingData.low = stats.low;
            holdingData.mean = mean;
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Buy', holdingData);
            resolve(holdingData);
        });
    });
}

function sell(data, status) {
    return new Promise(function(resolve, reject) {
        price = data.price;
        fix.placeOrder('sell', 'market', tradeAmountCoin, coin[0], false).then(function(data, err) {
            if (err) {
                console.log(err);
                reject(err);
            }

            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'SELL', price, data);

            let fee = tradeAmountCoin * price * feeRate;
            totalFees = parseFloat(totalFees) + parseFloat(fee);
            totalProfit = totalProfit + profit;

            // Add data to training set
            console.log('HOLDING DATA IN SELL', holdingData);
            let newTrainingRow = {
                date: holdingData.date,
                time: holdingData.time,
                price: holdingData.price,
                high: holdingData.high,
                low: holdingData.low,
                mean: holdingData.mean,
                standardDeviation: holdingData.standardDeviation,
                status: status
            };
            trainingSheet.addRow(newTrainingRow, function(err) {
                if (err) {
                    console.log(err);
                }
            });

            holdingData = false;
            resolve();
        });
    });
}

function trader(data) {
    return new Promise(function(resolve, reject) {
        // if the price is less than the mean it will probably come up
        console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Price', data.price);
        if (data.price < mean && standardDeviation > 100 && !holdingData) {
            // buy
            buy(data)
                .then(function(data) {
                    resolve(data);
                })
                .catch(function(err) {
                    console.log(err);
                    reject(err);
                });
        } else if (profit >= profitTarget && holdingData) {
            // sell winner
            sell(data, 1)
                .then(function(data) {
                    winners++;
                    resolve(data);
                })
                .catch(function(err) {
                    console.log(err);
                    reject(err);
                });
        } else if (profit < stopLoss && holdingData) {
            // sell loser
            sell(data, 0)
                .then(function(data) {
                    losers++;
                    resolve(data);
                })
                .catch(function(err) {
                    console.log(err);
                    reject(err);
                });
        } else if (holdingData) {
            // holding
            console.log(
                moment().format('YYYY/MM/DD HH:mm:ss'),
                'Holding',
                profit,
                totalProfit,
                profitTarget,
                stopLoss,
                standardDeviation,
                winners,
                losers
            );
            resolve();
        } else {
            // Not holding yet
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Not holding yet');
            resolve();
        }
    });
}

function calculateProfitLoss(data) {
    if (holdingData) {
        profit = (data.price - holdingData.price) * tradeAmountCoin;
        profitTarget = tradeAmountCoin * holdingData.price * target;
        stopLoss = tradeAmountCoin * holdingData.price * risk * -1;
    } else {
        // reset profit
        profit = 0;
        profitTarget = 0;
        stopLoss = 0;
    }
    console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Calculate Profit Loss', profit, profitTarget, stopLoss);
}

function handleTicks(data) {
    return new Promise(function(resolve, reject) {
        if (tickerData.length > ticks - 1) {
            async.series(
                [
                    function(callback) {
                        getStandardDeviation();
                        calculateProfitLoss(data);
                        trader(data)
                            .then(function(data) {
                                resolve();
                            })
                            .catch(function(err) {
                                console.log(err);
                                reject(err);
                            });
                    }
                ],
                function(err) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                }
            );
        } else {
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Getting Ticks', tickerData.length);
            resolve();
        }
    });
}

function main(data) {
    async.series(
        [
            // get todays data for mean revision
            function(callback) {
                getTradingRangeMean()
                    .then(function(data) {
                        //console.log(data);
                        callback();
                    })
                    .catch(function(err) {
                        if (err) {
                            console.log(err);
                        }
                    });
            },

            // push ticker data
            function(callback) {
                pushTickerData(data);
                callback();
            },

            // handleTicks
            function(callback) {
                handleTicks(data)
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
}

async.series(
    [
        // config apis
        function(callback) {
            configApi().then(function(data) {
                callback();
            });
        },

        function(callback) {
            getTrainingWorksheet().then(function(data) {
                callback();
            });
        },

        // init websocket
        function(callback) {
            initiateWebSocket();
        }
    ],
    function(err) {
        if (err) {
            console.log('Error: ' + err);
        }
    }
);
