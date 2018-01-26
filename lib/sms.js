// Twilio
var secrets         = require('../secrets.json');
const accountSid    = secrets.twilioSid;
const authToken     = secrets.twilioApiKey;
console.log(secrets);
console.log(secrets.twilioSid);
const twilio        = require('twilio')(secrets.twilioSid, secrets.twilioAccessToken);
const request       = require("request");
const from          = '+12242231645';
var exports         = module.exports = {};

console.log(twilio);

/*
dutchess

SID
SK5f450652e590c23887f21ffa7f1fa0fc

KEY TYPE
Master

SECRET
KixzDRbGDNuvwU6irVBOLVLbbHI8HmPK
*/

exports.send = function (number, body) {
    console.log('ALPHA');
    twilio.messages.create(
        {
          body: "Let's grab lunch at Milliways tomorrow!",
          to: '+6302175813',
          from: '+12242231645',
          mediaUrl: 'http://www.example.com/cheeseburger.png'
        },
        (err, message) => {
            console.log('asdf')
          process.stdout.write(message.sid);
        });
    /*
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
*/
    
};


