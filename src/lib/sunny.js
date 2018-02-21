/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "SUNNY"
Solar Power
*/

// Dependencies
const constants = require('./_constants.js');
var json2csv = require('json2csv');
var async = require('async');
var moment = require('moment');
var axios = require('axios');
var sleep = require('sleep');
var clone = require('clone');
var scraperjs = require('scraperjs');
var GoogleSpreadsheet = require('google-spreadsheet');
var Mailchimp = require('mailchimp-api-v3');
var secrets = require(constants.CONFIG + '/secrets.json');
var args = process.argv.slice(2);
const request = require("request");
const fs = require('fs');
const download = require('download');
const csv = require('csvtojson')

const csvFilePath = constants.TMP + '/sunspots.csv'
let solarJson = [];
let spots = 0;

/*
module.exports.makeHistoryFile
async.series([

    function getSolarData(step) {
        download('http://www.sidc.be/silso/INFO/sndtotcsv.php').then(data => {
            fs.writeFileSync(csvFilePath, data);
            console.log('Step 1: Download sun spot data');
            step();
        });
    },

    function convertSolarDataToJson(step) {
        csv({
            delimiter: ';',
            noheader: true
        })
            .fromFile(csvFilePath)
            .on('json',(jsonObj)=>{
                let obj = {
                    date: jsonObj.field1 + '-' + jsonObj.field2 + '-' + jsonObj.field3,
                    sunspots: jsonObj.field5 
                }
                solarJson.push(obj);
            })
            .on('done',(error)=>{
                solarJson = solarJson.slice(Math.max(solarJson.length - 100, 1))
                console.log(solarJson);
                console.log('Step 2: Convert sun spot data to json')
                step();
            })
    },
*/
module.exports.getTodaysSunSpots = function () {
    return new Promise(function (resolve, reject) {
        //scraperjs.StaticScraper.create('http://spaceweather.rra.go.kr/observation/space/environment/sunspot')
        scraperjs.StaticScraper.create('https://spaceweatherlive.com/en/solar-activity')
            .scrape(function ($) {
                //return $("#tableSunInfoDaily > tbody > tr:nth-child(1) > td:nth-child(2)").map(function() {
                return $("body > div.body > div > div > div.col-md-8 > div:nth-child(4) > div:nth-child(1) > div > b:nth-child(3)").map(function () {
                    return $(this).text();
                }).get();
            })
            .then(function (text) {
                //console.log(text);
                spots = text[0];
                //console.log('Step 3: There are ' + spots + ' sun spots today')
                resolve(spots);
            });
    });
}

module.exports.getSunSpotsByDate = function (Y, M, D) {
    return new Promise(function (resolve, reject) {
        scraperjs.StaticScraper.create('https://spaceweatherlive.com/en/archive/' + Y + '/' + M + '/' + D + '/dayobs')
            .scrape(function ($) {
                //return $("#tableSunInfoDaily > tbody > tr:nth-child(1) > td:nth-child(2)").map(function() {
                return $("body > div.body > div > div > div.col-md-8 > table:nth-child(5) > tbody > tr > td:nth-child(1)").map(function () {
                    return $(this).text();
                }).get();
            })
            .then(function (text) {
                //console.log(text);
                spots = text[0];
                //console.log('Step 3: There are ' + spots + ' sun spots today')
                resolve(spots);
            });
    })
}

    // get this week of su

