/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - SMS messaging module
- send(number, body, test)
*/

const constants = require('./_constants.js');
var secrets = require(constants.CONFIG + '/secrets.json');
const request = require('request');
const from = '+12242231645';
var exports = module.exports = {};
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var list = require(constants.CONFIG + '/phone-list.json');

// number   - not used
// body     - the body of the message
// test     - toggle testing mode
exports.send = function (number, body, test) {
    if (test == true) { list = { "Karl": "+16302175813" }; }
    //console.log('ALPHA', number, body, test);
    var sns = new AWS.SNS();
    return new Promise(function (resolve, reject) {
        for (k in list) {
            var params = {
                Message: 'Hey ' + k + ', ' + body,
                MessageStructure: 'string',
                PhoneNumber: list[k]
            };
            sns.publish(params, function (err, data) {
                if (err) {
                    console.log('ERROR', err, err.stack);
                    reject();
                } else {
                    //console.log('SUCCESS',data);
                    resolve();
                }
            });
        }
    });
};
