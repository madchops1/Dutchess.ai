const fix = require('./fix.js');
fix.placeOrder('sell', 'limit', '0.1', 'LTC-USD', false, '20.23')
    .then(function(data, err) {
        console.log('data', data);
    });