var secrets         = require('../secrets.json');
const request       = require("request");
var exports         = module.exports = {};

const apiURI = 'https://api.gdax.com';
const sandboxURI = 'https://api-public.sandbox.gdax.com';

const authedClient = new Gdax.AuthenticatedClient(
    secrets.gDaxApiKey,
    secrets.gDaxApiSecret,
    secrets.gDaxPassphrase,
    apiURI
);

authedClient.getCoinbaseAccounts((error, response, data) => {
    if (error) {
        // handle the error
        console.log(error);
    } else {
        console.log(data);
        // work with data
    }
});
  