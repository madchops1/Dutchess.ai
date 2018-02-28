/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - LTC MODULE

Gets ltc technical data 
Uses the gdax marketplace

AVAILABILITY:
- business days only
- ~last 10-12 trading cycles

METHODS:
- getRsiByDate(date)
-- date "YYYY-MM-DD"

NOTES:
This is prod ready.
Could add the  for now. 

*/

const constants = require('./_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const scraperjs = require('scraperjs');
const async = require('async');
const moment = require('moment');

let rsiData = '';
let rowIndex = 1;

module.exports.getRsiByDate;
module.exports.getRsiChangeByDates;
//getRsiByDate('2018-02-26');

function getRsiByDate(date) {
    return new Promise(function (resolve, reject) {

        async.series([

            // Step 1
            function getDate(step) {
                if (!date) {
                    date = moment().format('MM/DD/YYYY')
                } else {
                    date = moment(date).format('MM/DD/YYYY')
                }
                step();
            },

            // Step 2
            function getRows(step) {
                async.parallel([
                    function (callback) { getRow(1, callback) },
                    function (callback) { getRow(2, callback) },
                    function (callback) { getRow(3, callback) },
                    function (callback) { getRow(4, callback) },
                    function (callback) { getRow(5, callback) },
                    function (callback) { getRow(6, callback) },
                    function (callback) { getRow(7, callback) },
                    function (callback) { getRow(8, callback) },
                    function (callback) { getRow(9, callback) },
                    function (callback) { getRow(10, callback) },
                    function (callback) { getRow(11, callback) },
                    function (callback) { getRow(12, callback) }
                ], function (err, results) {
                    for (let k in results) {
                        if (date === results[k]) {
                            rowIndex = k + 1;
                        }
                    }
                    step();
                });
            },

            // Step 3
            function getRsi(step) {
                scraperjs.StaticScraper.create('https://www.marketvolume.com/stocks/relativestrengthindexrsi.asp?s=LTC&t=ltc-properties')
                    .scrape(function ($) {
                        return $('#calm > div.container > table > tbody > tr:nth-child(' + rowIndex + ') > td:nth-child(6)').map(function () {
                            return $(this).text();
                        }).get();
                    })
                    .then(function (text) {
                        rsiData = text[0];
                        console.log('Step 3: Get RSI Successful, ' + rsiData);
                        //step();
                        resolve(rsiData);
                    });
            }


        ], function (err) {
            if (err) {
                reject(err);
                console.log(err);
            }
        });

    });
};

function getRow(i, callback) {
    scraperjs.StaticScraper.create('https://www.marketvolume.com/stocks/relativestrengthindexrsi.asp?s=LTC&t=ltc-properties')
        .scrape(function ($) {
            return $('#calm > div.container > table > tbody > tr:nth-child(' + i + ') > td:nth-child(1)').map(function () {
                return $(this).text();
            }).get();
        })
        .then(function (text) {
            callback(null, text[0])
        })
}

function getRsiChangeByDates(startDate, endDate) {
    return new Promise(function (resolve, reject) {

        let startRsi,
            endRsi,
            rsiChange;

        async.series([
            function getStartRsi(step) {
                getRsiByDate(startDate).then(function (data) {
                    startRsi = data
                    step();
                });
            },
            function getEndRsi(step) {
                getRsiByDate(endDate).then(function (data) {
                    endRsi = data
                    step();
                });
            },
            function change(step) {
                rsiChange = endRsi - startRsi;
                resolve(rsiChange);
            }
        ], function (err) {
            if (err) {
                reject(err);
                console.log(err);
            }

        })
    });
}