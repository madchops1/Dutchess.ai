// Twilio
var secrets         = require('../secrets.json');
const accountSid    = secrets.twilioSid;
const authToken     = secrets.twilioApiKey;
const twilio        = require('twilio')(accountSid, authToken);
const request       = require("request");
const from          = '+12242231645';
var exports         = module.exports = {};

console.log(twilio);

exports.send = function (number, body) {
    console.log('ALPHA');
    
    //r//eturn new Promise(function(resolve, reject) {
        var body = 'hi there';
        console.log(body);
        twilio.messages.create({
                to:     '+16302175813',
                from:   from,
                body:   body
            })
            .then(function(error, message){

                console.log('err',error,message);
                //resolve();
                //step();
            
            });
    //..});
    
};


