/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "Jameson"

Lets just try this:
Place limit buy order ~0.35 cents less than current price
When its successfull place an limit sell order ~.30 cents higher than the current price
Limit orders only. 
No fees. 
Continuously place orders.

NOTES:
Can I place a whole spread of orders, Then cancel them if they don't come in...?

*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const moment = require('moment');
const fix = require(constants.LIB + '/fix.js');
const Gdax = require('gdax');
const async = require('async');
const apiURI = 'https://api.gdax.com';

let buyData = false;
let sellData = false;
let profit = 0;
let totalProfit = 0;

// Dials
let coin = ['LTC-USD'];
let tradeAmountCoin = 0.1;
let orderInProgress = false;

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

function buy(prices) {
    return new Promise(function(resolve, reject) {
        if (orderInProgress) {
            resolve();
            return;
        }
        orderInProgress = true;
        let price = parseFloat(prices.price - 0.35).toFixed(2);

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

function sell(prices) {
    return new Promise(function(resolve, reject) {
        if (orderInProgress) {
            resolve();
            return;
        }
        orderInProgress = true;
        let price = parseFloat(prices.price + 0.3).toFixed(3);

        //price = data.price;
        fix.placeOrder('sell', 'limit', tradeAmountCoin, coin[0], false, price, 'GTC', true).then(function(data, err) {
            if (err) {
                console.log(err);
                reject(err);
            }
            orderInProgress = false;
            if (data.status == 'pending') {
                sellData = data;
                sellData.orderId = data.id;
                sellData.orderStatus = data.status;
                sellData.price = price;
                sellData.date = moment().format('MM/DD/YYYY');
                sellData.time = moment().format('hh:mm A');
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
        // If there is a buy in progress
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
            // If there is a buy complete and a sell in progress
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

function calculateProfitLoss(data) {
    if (buyData && !sellData) {
        profit = (data.price - buyData.price) * tradeAmountCoin;
    } else if (buyData && sellData) {
        profit = (sellData.price - buyData.price) * tradeAmountCoin;
    } else if (!buyData && !sellData) {
        profit = 0;
    }
    console.log(moment().format('YYYY/MM/DD HH:mm:ss'), 'Calculate Profit Loss', totalProfit, profit);
}

function trader(data) {
    return new Promise(function(resolve, reject) {
        if (!buyData && !sellData) {
            // buy
            buy(data).then(function(data) {
                resolve();
            });
        } else if (buyData.orderStatus == 'done' && !sellData) {
            // sell
            sell(data).then(function(data) {
                resolve();
            });
        } else if (buyData && !sellData) {
            console.log('Buying', buyData);
        } else if (buyData && sellData) {
            console.log('Selling', buyData, sellData);
        } else {
            console.log('Other', buyData, sellData);
        }
    });
}

function handleTicks(data) {
    return new Promise(function(resolve, reject) {
        async.series(
            [
                // checking fill status
                function(callback) {
                    fillStatus().then(function(data) {
                        callback();
                    });
                },

                // trade
                function(callback) {
                    //calculateProfitLoss(data);
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
    });
}

function main(data) {
    async.series(
        [
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
