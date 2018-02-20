/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "BELLA"
Backtest Data Getter
- Runs whenever you want to generate backtest tick data
- Works with LTC, BTC, and ETH
*/

const secrets = require('./config/secrets.json');
const Gdax = require('gdax');
const fs = require('fs');

let json = '';

// Dials
let coin = ['LTC-USD'];
let currency = 'LTC';
let filePath = './.tmp/' + currency + '.backtestTickData.json';

fs.writeFile(filePath, json, 'utf8', function (err, data) {
    if (err) { console.log(err); }
    console.log(data);
});

const ws = createWebsocket(false, coin);
ws.on('message', data => {
    if (data.type === 'ticker') {
        ++count
        console.log(count);
        //tickerData.push(data.price);

        //}
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