/*
DUTCHESS.AI - GDAX FIX TRADE MODULE
*/
let secrets           = require('../config/secrets.json');
const request         = require("request");
const Gdax            = require('gdax');

let apiURI          = 'https://api.gdax.com';
let apiSandboxURI   = 'https://api-public.sandbox.gdax.com';

function authedClient (test) {
    if(test) {
        apiURI                  = apiSandboxURI;
        secrets.gDaxApiKey      = secrets.gDaxSandboxApiKey;
        secrets.gDaxApiSecret   = secrets.gDaxSandboxApiSecret;
        secrets.gDaxPassphrase  = secrets.gDaxSandboxPassphrase;
    }
    return new Gdax.AuthenticatedClient(
        secrets.gDaxApiKey,
        secrets.gDaxApiSecret,
        secrets.gDaxPassphrase,
        apiURI
    );
}

module.exports.placeOrder = function (side = 'buy', type = 'market', size = '0.001', product = 'BTC-USD', test = true) {
    return new Promise(function(resolve, reject) {
        var client = authedClient(test);
        client.getCoinbaseAccounts((error, response, data) => {
            if (error) { console.log(error); } 
            else {
                let params = {
                    side: side,
                    type: type,
                    size: size,
                    product_id: product,
                };
                client.placeOrder(params, (error, response, data) => {
                    //console.log(error, response, data);
                    if(error) { reject(error); }
                    //console.log('params', params);
                    resolve(data);
                });
            }
        });
    });
};
