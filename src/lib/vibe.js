/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - Vibe
Get the vibe of a string of text.
*/

const constants = require('./_constants.js');
const secrets = require(constants.CONFIG + '/secrets.json');
const sentiment = require('sentiment');
let positiveMatches = 0;
let negativeMatches = 0;

let positiveKeys = [
    {
        key: 'jumps'
    },
    {
        key: 'rose'
    },
    {
        key: 'rising'
    },
    {
        key: 'gains'
    },
    {
        key: 'gained'
    },
    {
        key: 'gaining'
    },
    {
        key: 'increase'
    },
    {
        key: 'prosperity'
    },
    {
        key: 'prosper'
    },
    {
        key: 'bull'
    },
    {
        key: 'bullish'
    },
    {
        key: 'positive'
    },
    {
        key: 'green'
    },
    {
        key: 'winning'
    },
    {
        key: 'winner'
    },
    {
        key: 'win'
    },
    {
        key: 'progress'
    },
    {
        key: 'won'
    },
    {
        key: 'momentum'
    }
];

let negativeKeys = [
    {
        key: 'falls'
    },
    {
        key: 'falling'
    },
    {
        key: 'decrease'
    },
    {
        key: 'decreases'
    },
    {
        key: 'depression'
    },
    {
        key: 'losses'
    },
    {
        key: 'bear'
    },
    {
        key: 'bearish'
    },
    {
        key: 'negative'
    },
    {
        key: 'red'
    },
    {
        key: 'regression'
    },
    {
        key: 'lose'
    },
    {
        key: 'losing'
    },
    {
        key: 'lost'
    },
    {
        key: 'subpar'
    }
];

function scanForPositiveKeys(string) {
    for (let i = 0; i < positiveKeys.length; i++) {
        //string.indexOf(substring) !== -1;
        if (string.indexOf(positiveKeys[i].key) !== -1) {
            positiveMatches++;
        }
    }
}

function scanForNegativeKeys(string) {
    for (let i = 0; i < negativeKeys.length; i++) {
        //string.indexOf(substring) !== -1;
        if (string.indexOf(negativeKeys[i].key) !== -1) {
            negativeMatches++;
        }
    }
}

module.exports.read = function(string) {
    string = string.toLowerCase();
    scanForNegativeKeys(string);
    scanForPositiveKeys(string);
    sentimentData = sentiment(string);
    //console.log(sentimentData);
    let response = {
        positiveMatches: positiveMatches,
        negativeMatches: negativeMatches,
        sentiment: sentimentData.score
    };
    return response;
};
