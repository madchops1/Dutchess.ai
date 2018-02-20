const fix = require('./fix.js');
/*fix.placeOrder('sell', 'market', '0.1', 'LTC-USD', true)
    .then(function (data, err) {
        if (err) { console.log(err); }
        console.log('data', data);
    });*/

fix.getAccountValue()
    .then(function (data, err) {
        if (err) { console.log(err); }
        console.log(data);
    });