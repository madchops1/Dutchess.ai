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
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(secrets.newsApiKey);
const vibe = require('./vibe.js');

let totalArticles = 0;
let newsData = false;
let positiveMatches = 0;
let negativeMatches = 0;
let sentiment = 0;

// Dials
let coin = ['LTC-USD'];

module.exports.vibeNews = main;

function getNews(string) {
    return new Promise(function(resolve, reject) {
        newsapi.v2
            .topHeadlines({
                q: string,
                language: 'en'
            })
            .then(function(data) {
                totalArticles = data.totalResults;
                newsData = data.articles;
                resolve();
            });
    });
}

function readNews() {
    return new Promise(function(resolve, reject) {
        async.each(
            newsData,
            function(item, callback) {
                let vibeData = vibe.read(item.description);
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
                    getNews(string)
                        .then(function(data) {
                            callback();
                        })
                        .catch(function(err) {
                            console.log(err);
                        });
                },

                function(callback) {
                    readNews()
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
                console.log(sentiment, totalArticles);
                let score = 0;
                if (totalArticles > 0) {
                    score = sentiment / totalArticles;
                }
                let response = {
                    sentiment: score,
                    positiveMatches: positiveMatches,
                    negativeMatches: negativeMatches,
                    totalArticles: totalArticles
                };
                resolve(response);
            }
        );
    });
}
