/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - Vibe the News

Get the vibe of the news.
*/

const constants = require('./_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const async = require('async');
const vibe = require('./vibe.js');
const twit = require('twit');
const moment = require('moment');

const twitter = new twit({
    consumer_key: secrets.twitterConsumerKey,
    consumer_secret: secrets.twitterConsumerSecret,
    access_token: secrets.twitterAccessToken,
    access_token_secret: secrets.twitterAccessTokenSecret
});

let totalTweets = 0;
let tweetData = false;
let positiveMatches = 0;
let negativeMatches = 0;
let sentiment = 0;

// Dials
let coin = ['LTC-USD'];
let count = 20;

module.exports.vibeTweets = main;

function getTweets(string) {
    return new Promise(function(resolve, reject) {
        twitter.get(
            'search/tweets',
            {
                q: string + ' since:' + moment().format('YYYY-MM-DD'),
                count: count
            },
            function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                //console.log(data);
                tweetData = data['statuses'];
                resolve();
            }
        );
    });
}

function readTweets() {
    return new Promise(function(resolve, reject) {
        async.each(
            tweetData,
            function(item, callback) {
                //console.log(item.text);
                let vibeData = vibe.read(item.text);
                //console.log(vibeData);
                positiveMatches = positiveMatches + vibeData.positiveMatches;
                negativeMatches = negativeMatches + vibeData.negativeMatches;
                sentiment = sentiment + vibeData.sentiment;
                resolve();
            },
            function(err) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                resolve();
            }
        );
    });
}

function main(string) {
    return new Promise(function(resolve, reject) {
        async.series(
            [
                function(callback) {
                    getTweets(string)
                        .then(function(data) {
                            callback();
                        })
                        .catch(function(err) {
                            console.log(err);
                        });
                },

                function(callback) {
                    readTweets()
                        .then(function(data) {
                            callback();
                        })
                        .catch(function(err) {
                            console.log(err);
                        });
                }
            ],
            function(err) {
                if (err) {
                    console.log('Error: ' + err);
                    reject(err);
                }
                let response = {
                    sentiment: sentiment / count,
                    positiveMatches: positiveMatches,
                    negativeMatches: negativeMatches,
                    totalTweets: count
                };
                resolve(response);
            }
        );
    });
}
