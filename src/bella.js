/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "BELLA"
Backtest Ticker Data Generator
- Runs whenever you want to generate backtest tick data
- Works with LTC, BTC, and ETH

NOTES:
Bella gets and saves backtest tick data
*/

const constants = require('./lib/_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const Gdax = require('gdax');
const fs = require('fs');
const uuid = require('node-uuid');

// Define
let json = [];
let count = 0;

// Knobs
let coin = ['LTC-USD'];
let currency = 'LTC';
let filePath = constants.TMP + '/' + currency + '.tickers.' + uuid.v4() + '.json';
let tickTarget = 10000;
let body = '';

const ws = createWebsocket(false, coin);
ws.on('message', data => {
    if (data.type === 'ticker') {
        ++count
        console.log(count);
        json.push(data);
        if (count >= tickTarget) {
            body = JSON.stringify(json);
            fs.writeFile(filePath, body, 'utf8', function (err, data) {
                if (err) { console.log(err); }
                console.log('DONE')
                process.exit(1);
            });
        }
    }
});

ws.on('error', err => {
    console.log('error', err);
});

ws.on('close', () => {
    console.log('close');
});

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