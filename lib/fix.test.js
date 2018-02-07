const fix = require('./fix.js');
fix.placeOrder('buy', 'market', '0.01', 'BTC-USD', true)
    .then(function(data, err) {
        console.log('data', data);
    });