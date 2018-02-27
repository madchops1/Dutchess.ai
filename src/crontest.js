/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - CRON TEST


NOTES:


*/

const constants = require('./lib/_constants.js');
const sms = require(constants.LIB + '/sms.js');
sms.send('+16302175813', 'Dutchess.ai cron test', true).then(function () {

});