var secrets           = require('../secrets.json');
const sms             = require('./sms.js');
sms.send('+16302175813', 'asdf', true).then(function(){
    console.log('yay');
});