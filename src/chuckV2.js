/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "ChuckV2"

Use the order book to get the best bid/ask 
build a limit order algo trader that doesn't have fees

This tries to buy at the momentum and the current price vs the short price average to 
determine the best buy in moment.

Then it sells when there is profit regardless of momentum

*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const fix = require(constants.LIB + '/fix.js');
const Gdax = require('gdax');
const async = require('async');
const apiURI = 'https://api.gdax.com';
//const GoogleSpreadsheet = require('google-spreadsheet');
//const trainingSheetId = secrets.MerlinTrainingSheetId;

//let trainingDoc = new GoogleSpreadsheet(trainingSheetId);
//let trainingSheet;
//let creds = require(constants.CONFIG + '/sheetsClientSecret.json');
//let mean = 0;
//let stats = false;
//let shortMean = 0;
let tickerData = [];
//let standardDeviation = 0;
let buyData = false;
let sellData = false;
let profit = 0;
let profitTarget = 0; // calculated by the
let stopLoss = 0;
let totalProfit = 0;
let winners = 0;
let losers = 0;
let longMomentumAvgs = [];
let shortMomentumAvgs = [];
let book = {};
let orderId = false;
let orderInProgress = false;
let gettingOrderBook = false;
//let feeRate = 0.003;
//let totalFees = 0;

// Dials
let coin = ['LTC-USD'];
let ticks = 960;
let tradeAmountCoin = 0.1;
let risk = 0.01;
let targetRatio = 1; // x:1 x:risk
let target = risk * targetRatio;

function configApi() {
    return new Promise(function(resolve, reject) {
        GdaxClient = authedClient();
        //trainingDoc.useServiceAccountAuth(creds, function() {
        resolve();
        //});
    });
}

function authedClient() {
    console.log('Config Gdax');
    return new Gdax.AuthenticatedClient(secrets.gDaxApiKey, secrets.gDaxApiSecret, secrets.gDaxPassphrase, apiURI);
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

function calculateProfitLoss(data) {
    //console.log();
    if (buyData && !sellData) {
        profit = (parseFloat(parseFloat(book.bids[0][0]) + 0.01).toFixed(2) - buyData.price) * tradeAmountCoin;
        profitTarget = tradeAmountCoin * buyData.price * target;
        stopLoss = tradeAmountCoin * buyData.price * risk * -1;
    } else if (buyData && sellData) {
        profit = (sellData.price - buyData.price) * tradeAmountCoin;
        profitTarget = tradeAmountCoin * buyData.price * target;
        stopLoss = tradeAmountCoin * buyData.price * risk * -1;
    } else if (!buyData && !sellData) {
        // reset profit
        profit = 0;
        profitTarget = 0;
        stopLoss = 0;
    }
    console.log(
        moment().format('YYYY/MM/DD HH:mm:ss'),
        'Calculate Profit Loss',
        book,
        data.price,
        totalProfit,
        profit,
        profitTarget,
        stopLoss,
        winners,
        losers
    );
}

function momentumIsUp() {
    //console.log(
    //    'Momentum',
    //    shortMomentumAvgs[shortMomentumAvgs.length - 1] - longMomentumAvgs[longMomentumAvgs.length - 1]
    //);
    if (shortMomentumAvgs[shortMomentumAvgs.length - 1] > longMomentumAvgs[longMomentumAvgs.length - 1]) {
        if (tickerData[tickerData.length - 1] < shortMomentumAvgs[shortMomentumAvgs.length - 1]) {
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Momentum is up');
            return true;
        }
    }
    return false;
}

function momentumIsDown() {
    //console.log(
    //    'Momentum',
    //    shortMomentumAvgs[shortMomentumAvgs.length - 1] - longMomentumAvgs[longMomentumAvgs.length - 1]
    //);
    if (shortMomentumAvgs[shortMomentumAvgs.length - 1] < longMomentumAvgs[longMomentumAvgs.length - 1]) {
        if (tickerData[tickerData.length] - 1 > shortMomentumAvgs[shortMomentumAvgs.length - 1]) {
            console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Momentum is down');
            return true;
        }
    }
    return false;
}

function calculateMomentum() {
    console.log('Calculate Momentum');
    let longMomentumAvg = getArrayAvg(tickerData);
    let shortMomentumAvg = getArrayAvg([tickerData[tickerData.length - 1], tickerData[tickerData.length - 2]]);
    longMomentumAvgs.push(longMomentumAvg);
    shortMomentumAvgs.push(shortMomentumAvg);
}

function getOrderBook() {
    return new Promise(function(resolve, reject) {
        if (gettingOrderBook) {
            resolve(book);
            return;
        }
        gettingOrderBook = true;
        GdaxClient.getProductOrderBook(coin[0], { level: 1 }, (error, response, _book) => {
            if (error) {
                console.log(error);
                reject(error);
            }
            gettingOrderBook = false;
            //console.log('BOOK', _book);
            book = _book;
            resolve(book);
        });
    });
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

function buy(prices) {
    return new Promise(function(resolve, reject) {
        if (orderInProgress) {
            resolve();
            return;
        }
        orderInProgress = true;
        let price = parseFloat(parseFloat(book.asks[0][0]) - 0.01).toFixed(3);

        fix.placeOrder('buy', 'limit', tradeAmountCoin, coin[0], false, price, 'GTC', true).then(function(data, err) {
            if (err) {
                console.log(err);
                reject(err);
            }
            orderInProgress = false;
            console.log('ALPHA', data);
            //let fee = tradeAmountCoin * price * feeRate;
            //totalFees = parseFloat(totalFees) + parseFloat(fee);
            if (data.status == 'pending') {
                sellData = false;
                buyData = prices;
                buyData.orderId = data.id;
                buyData.orderStatus = data.status;
                buyData.price = price;
                buyData.date = moment().format('MM/DD/YYYY');
                buyData.time = moment().format('hh:mm A');

                console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Buy Success', price, prices.price);
                resolve(buyData);
            } else {
                buyData = false;
                sellData = false;
                console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Buy Rejected', price, prices.price);
                resolve();
            }
        });
    });
}

function sell(prices, status) {
    return new Promise(function(resolve, reject) {
        if (orderInProgress) {
            resolve();
            return;
        }
        orderInProgress = true;
        let price = parseFloat(parseFloat(book.bids[0][0]) + 0.01).toFixed(2);

        //price = data.price;
        fix.placeOrder('sell', 'limit', tradeAmountCoin, coin[0], false, price, 'GTC', true).then(function(data, err) {
            if (err) {
                console.log(err);
                reject(err);
            }
            orderInProgress = false;

            //let fee = tradeAmountCoin * price * feeRate;
            //totalFees = parseFloat(totalFees) + parseFloat(fee);
            if (data.status == 'pending') {
                //totalProfit = totalProfit + profit;
                //holdingData = false;
                sellData = data;
                sellData.orderId = data.id;
                sellData.orderStatus = data.status;
                sellData.price = price;
                sellData.date = moment().format('MM/DD/YYYY');
                sellData.time = moment().format('hh:mm A');
                if (status == 1) {
                    ++winners;
                } else {
                    ++losers;
                }
                console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'SELL SUCCESS', data);
            } else {
                console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'SELL REJECTED', data);
                sellData = false;
            }
            resolve();
        });
    });
}

function fillStatus() {
    return new Promise(function(resolve, reject) {
        if (!sellData && !buyData) {
            resolve();
            return;
        }
        if (buyData && !sellData) {
            GdaxClient.getOrder(buyData.orderId, function(err, data, response) {
                if (err) {
                    console.log(err);
                    reject(err);
                }

                console.log('BETA', response);
                if (response && response.status == 'done') {
                    buyData.orderStatus = 'done';
                }

                resolve();
            });
        } else if (buyData && sellData) {
            GdaxClient.getOrder(sellData.orderId, function(err, data, response) {
                if (err) {
                    console.log(err);
                    reject(err);
                }

                console.log('CHARLIE', response);
                if (response && response.status == 'done') {
                    //sellData.orderStatus == 'done';
                    totalProfit = totalProfit + profit;
                    sellData = false;
                    buyData = false;
                }

                resolve();
            });
        }
    });
}

function trader(data) {
    return new Promise(function(resolve, reject) {
        // if the price is less than the mean it will probably come up
        //console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Price', data.price);
        if (momentumIsUp() && !buyData && !sellData) {
            buy(data).then(function(data) {
                resolve();
            });
        } else if (profit >= 0.02 && buyData.orderStatus == 'done' && !sellData) {
            // sell for profit
            sell(data, 1).then(function(data) {
                resolve();
            });
        } else if (profit < stopLoss && buyData.orderStatus == 'done' && !sellData) {
            // sell at a loss
            sell(data, 0).then(function(data) {
                resolve();
            });
        } else if (sellData && buyData) {
            console.log('Selling', buyData, sellData);
        } else if (buyData.orderStatus != 'done' && buyData && !sellData) {
            console.log('Buying', buyData);
        } else if (buyData.orderStatus == 'done' && !sellData) {
            console.log('Holding', buyData);
        } else {
            console.log('No Holding', buyData, sellData);
        }
    });
}

function handleTicks(data) {
    return new Promise(function(resolve, reject) {
        if (tickerData.length > ticks - 1) {
            async.series(
                [
                    // get best bid/ask
                    function(callback) {
                        getOrderBook().then(function(data) {
                            callback();
                        });
                    },

                    // checking fill status
                    function(callback) {
                        fillStatus().then(function(data) {
                            callback();
                        });
                    },

                    // trade
                    function(callback) {
                        calculateMomentum();
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

async.series(
    [
        // config apis
        function(callback) {
            configApi().then(function(data) {
                callback();
            });
        },

        //function(callback) {
        //    getTrainingWorksheet().then(function(data) {
        //        callback();
        //    });
        //},

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
