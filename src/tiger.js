/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "TIGER"
- Outputs tomorrows bitcoin prediction up/down
- AWS ML training of Bitcoin's historical price and Google Trends correlation
- Twitter Emotion for the day... vibe api whats the vibe

NOTES:
Tiger is currently running on cron improduction @ 11pm
*/

const constants = require('./lib/_constants.js')
var secrets = require(constants.CONFIG + '/secrets.json');
var async = require('async');
var moment = require('moment');
var json2csv = require('json2csv');
var sleep = require('sleep');
var args = process.argv.slice(2);
const sms = require(constants.LIB + '/sms.js');

// AWS dependencies
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

// Coinbase
var Client = require('coinbase').Client;
var coinbase = new Client({ 'apiKey': secrets.CoinbaseApiKey, 'apiSecret': secrets.CoinbaseApiSecret });
const Gdax = require('gdax');
const publicClient = new Gdax.PublicClient();

// Google Trends
var googleTrends = require('google-trends-api');

// Google Sheets
var GoogleSpreadsheet = require('google-spreadsheet');
var sheetId = secrets.TigerSheetId;
var doc = new GoogleSpreadsheet(sheetId);
var creds = require(constants.CONFIG + '/sheetsClientSecret.json');
var sheet;
var latestRowDate;
var missingData;
var updatedDoc;
var updatedSheet;
var csvData;
var newRows = [];
var predDate;
var currentPrice;
var openPrice;
var lastPrice;
var lowPrice;
var highPrice;

// S3
var bucketName = secrets.TigerBucketName;
var keyName = 'data-' + moment().format("YYYY-MM-DD") + '.csv';

// Mailchimp
var test = false;
var Mailchimp = require('mailchimp-api-v3');
if (args[0] === 'test') { test = true; }
var mailchimpApiKey = secrets.MailchimpApiKey;
var listId = secrets.MailchimpListId;
var mailchimp = new Mailchimp(mailchimpApiKey);
var campaign;

// Machine Learning 
var mL = new AWS.MachineLearning({ 'region': 'us-east-1' });
var trainingDatasourceId;
var evaluationDatasourceId;
var modelId;
var evaluationId;
var predictionEndpoint;
var prediction;
var predictionScore;
var predictionDirection;
var predictionPosition;

var dataSchemaWinLoss = dataSchema('winloss');
//var dataSchemaPrice     = dataSchema('price');

// Settings
var days = 100;
//var notification = 'sms';

var startTime = moment().subtract(days, 'days');
var endTime = moment();

// - get the sheet
async.series([

    // Step 1 Authenticate google sheets
    function setAuth(step) {
        console.log('Step 1.1: Log, TODO...');
        console.log('Step 1.2: Authenticated Google Sheets');
        doc.useServiceAccountAuth(creds, step);
    },

    // Step 2 Get sheet
    function getInfoAndWorksheets(step) {
        doc.getInfo(function (err, info) {
            sheet = info.worksheets[0];
            console.log('Step 2: Get Sheet Successful, ' + sheet.rowCount + ' rows');
            step();
        });
    },

    // Step 3 Clear the sheet, count up then counts down.
    function clearSheet(step) {
        sheet.getRows({}, function (err, rows) {
            if (err) { console.log(err); }
            var functions = [];
            var ids = [];
            for (var k in rows) {
                //console.log('K',rows[k].id);
                fun = function (ss) {
                    //console.log('k',k);
                    rows[k].del(function (err) {
                        if (err) { console.log(err); }
                        --k;
                        ss();
                    });
                };
                functions.push(fun);
            }
            async.series(functions, function (err) { if (err) { console.log(err); } console.log('Step X: Clear Sheet Successful'); step(); });
        });
    },

    // Step 4 Get past x number of recorded days historical Google Trend Interest
    function getTrendData(step) {


        var startTimeF = startTime.toDate();
        var endTimeF = endTime.toDate();

        //console.log('Starttime',startTime);
        googleTrends.interestOverTime({ keyword: 'Bitcoin', startTime: startTimeF, endTimeF: endTime })
            .then(function (results) {
                var json = JSON.parse(results);
                missingData = json.default.timelineData;
                console.log('Step 4: Get Historical Google Trends Data Successful,', missingData.length);
                step();
            })
            .catch(function (err) {
                console.error(err);
            });
    },

    // Step 5.1 Get the historical BTC Price Data from Coinbase
    function getPriceDataCoinbase(step) {
        var functions = [];
        for (var k in missingData) {
            var fun = function (ss) {
                //sleep.sleep(5);
                var date = moment.unix(missingData[k].time).format("YYYY-MM-DD");
                coinbase.getSpotPrice({ 'currencyPair': 'BTC-USD', 'date': date }, function (err, obj) {

                    //console.log(dots+'\r');
                    process.stdout.write(dots + '\r');
                    dots += '.';

                    if (err) {
                        missingData[k].price = '';
                    } else {
                        missingData[k].price = obj.data.amount;
                        //console.log(date,missingData[k].price);
                    }
                    ++k;
                    ss();
                });
            }
            functions.push(fun);
        }
        k = 0;
        var dots = '.';
        async.series(functions, function (err) { if (err) { console.log(err); } console.log('Step 5.1: Get Price Data From Coinbase Successful'); step(); });
    },

    // Step 5.2 Get historical bitcoin price data from gDax
    function getPriceDataGdax(step) {

        // To include extra parameters:
        var start = startTime.toISOString();
        var end = endTime.toISOString();
        console.log(start, end);

        publicClient.getProductHistoricRates('BTC-USD', { start: start, end: end, granularity: 86400 }, function (err, res) {
            if (err) { console.log('ERR', err); }
            //console.log('RES' ,res.body);
            var data = JSON.parse(res.body);
            //console.log('RES', data);

            //[  time, low, high, open, close, volume ],
            // [ 1415398768, 0.32, 4.2, 0.35, 4.2, 12.3 ]
            //var dots = '.';
            for (var k in data) {
                for (var l in missingData) {
                    if (moment.unix(data[k][0]).format("YYYY-MM-DD") == moment.unix(missingData[l].time).format("YYYY-MM-DD")) {

                        //console.log(dots+'\r');
                        //process.stdout.write(dots+'\r');
                        //dots += '.';

                        missingData[l].date = moment.unix(missingData[l].time).format("YYYY-MM-DD");
                        missingData[l].low = data[k][1];
                        missingData[l].high = data[k][2];
                        missingData[l].open = data[k][3];
                        missingData[l].close = data[k][4];
                        missingData[l].volume = data[k][5];
                        //console.log(missingData[l].date, missingData[l].open, missingData[l].close);

                    }

                }
                //console.log(moment.unix(data[k][0]).format("MM/DD/YYYY"));
            }
            console.log('Step 5.2: Get Price Data From gDax Successful');
            step();
            //for(var k in missingData) {

            //}


        });

    },

    // Step 6 Add data to the sheet
    function addDataToSheet(step) {
        //console.log('BOO');
        var functions = [];
        var data = missingData;
        var _lastPrice = 0;
        var k = 0;
        while (k < data.length) {
            var date = '---';
            var change;
            var change2;
            var winloss;

            // date split
            if (data[k].date) {
                date = data[k].date.split('-');
            }

            // coinbase change
            /*
            if(lastPrice != 0) { 
                change2 = data[k].price - lastPrice;
            } else {
                change2 = '';
            }
            */

            // gdax change
            change = data[k].close - data[k].open;

            // avg not used
            avgChange = (change2 + change) / 2;

            if (change < 0) {
                winloss = 0;
            } else {
                winloss = 1;
            }

            /*
            if(k > 0) {
                var b = k-1;
                if(b>=0) {
                    if(data[k].price != "") {
                        newRows[b].change2 = change2;
                    } else {
                        //newRows[b].change2 = change2
                    }
                }
            }
            */

            var newRow = {
                date: data[k].date,
                interest: data[k].value,
                baselinedate: k,
                month: date[1],
                day: date[2],
                year: date[0],
                price: data[k].price,
                low: data[k].low,
                high: data[k].high,
                open: data[k].open,
                close: data[k].close,
                change: change,
                volume: data[k].volume,
                winloss: winloss
            };
            newRows.push(newRow);
            var fun = function (ss) {
                //console.log(k,newRows[k].date);
                if (newRows[k].date) {
                    sheet.addRow(newRows[k],
                        function (err) {
                            if (err) {
                                console.log(err);
                            }
                            openPrice = newRows[k].open;
                            lastPrice = newRows[k].close;
                            lowPrice = newRows[k].low;
                            highPrice = newRows[k].high;
                            latestRowDate = new moment(newRows[k].date); // update latest row date to the latest row with updated data
                            ++k;
                            ss();
                        });
                }
            };
            functions.push(fun);
            _lastPrice = data[k].price;
            ++k;
        }
        k = 0;
        async.series(functions, function (err) { if (err) { console.log(err); } console.log('Step 6: Push Data To Sheet Successful'); step(); });
    },

    // Step 7 convert to csv
    function convertCsv(step) {
        json2csv({ data: newRows, fields: Object.keys(newRows[0]) }, function (err, csv) {
            if (err) { console.log(err); }
            console.log('Step 7: Convert Data To CSV Successfull');
            csvData = csv;
            step();
        });
    },

    // Step 8 upload to s3
    function uploadCsvToS3(step) {
        var s3 = new AWS.S3();
        //s3.createBucket({Bucket: bucketName}, function() {
        var params = { Bucket: bucketName, Key: keyName, Body: csvData };
        s3.putObject(params, function (err, data) {
            if (err) {
                console.log(err)
            } else {
                console.log("Step 8: Successfully Uploaded Data To " + bucketName + "/" + keyName);
            }
            step();
        });
        //});
    },

    // Step 9 create winloss prediction training datasource
    function createMlTrainingDatasource(step) {
        trainingDatasourceId = 'tiger-train-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: trainingDatasourceId,
            DataSpec: {
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":0, "percentEnd":70, "strategy":"random"}}',
                DataSchema: dataSchemaWinLoss
            },
            ComputeStatistics: true,
            DataSourceName: 'Tiger Strategy Training 0-70 ' + moment().format("YYYY-MM-DD")
        };
        mL.createDataSourceFromS3(params, function (err, data) {
            if (err) { console.log(err, err.stack); } // an error occurred
            else {
                console.log('Step 9: Create Testing Datasource Successfull');
                step();
            }
        });
    },

    // Step 10 create winloss prediction eval datasource
    function createMlEvaluationDatasource(step) {
        evaluationDatasourceId = 'tiger-eval-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: evaluationDatasourceId,
            DataSpec: {
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":70, "percentEnd":100, "strategy":"random"}}',
                DataSchema: dataSchemaWinLoss
            },
            ComputeStatistics: true,
            DataSourceName: 'Tiger Strategy Evaluation 70-100 ' + moment().format("YYYY-MM-DD")
        };
        mL.createDataSourceFromS3(params, function (err, data) {
            if (err) { console.log(err, err.stack); } // an error occurred
            else {
                console.log('Step 10: Create Evaluation Datasource Successfull');
                step();
            }
        });
    },

    // Step 11 create the model
    function createMlModel(step) {
        modelId = 'tiger-model-' + uuid.v4() + '';
        var params = {
            MLModelId: modelId,
            MLModelType: "BINARY",
            TrainingDataSourceId: trainingDatasourceId,
            MLModelName: 'Tiger Strategy Model ' + moment().format("YYYY-MM-DD"),
            Parameters: {
                'sgd.shuffleType': 'auto'
            }
        };
        mL.createMLModel(params, function (err, data) {
            if (err) { console.log(err, err.stack); }
            else {
                console.log('Step 11: Create Machine Learning Model Successfull');
                step();
            }
        });
    },

    // Step 12 create realtime trading endpoint
    function createMlRealtimePredictionEndpoint(step) {
        function waitForMlModel() {
            var params = {
                MLModelId: modelId,
            };
            mL.getMLModel(params, function (err, data) {
                if (err) { console.log(err, err.stack); }
                else {
                    if (data.Status !== 'COMPLETED') {
                        console.log('Step 12: Machine Learning Model is ' + data.Status + ', waiting 30 sec...');
                        sleep.sleep(30);
                        waitForMlModel();
                    } else {
                        console.log('Step 12: Machine Learning Model Status: COMPLETED');
                        var params = { MLModelId: modelId };
                        mL.createRealtimeEndpoint(params, function (err, data) {
                            if (err) { console.log(err, err.stack); }
                            else {
                                //console.log(data);   
                                predictionEndpoint = data.RealtimeEndpointInfo.EndpointUrl;
                                console.log('Step 12: Realtime Prediction Endpoint Created Successfully');
                                step();
                            }
                        });
                    }
                }
            });
        }
        waitForMlModel();
    },

    // Step 13 get the current price
    function getCurrentPrice(step) {
        var date = moment().format("YYYY-MM-DD");
        coinbase.getSpotPrice({ 'currencyPair': 'BTC-USD', 'date': date }, function (err, obj) {
            if (err) { console.log(err); } else {
                currentPrice = obj.data.amount;
                console.log('Step 13: Get Current Bitcoin Price Successful', currentPrice);
                step();
            }
        });
    },

    // Step 14 predict 
    function predictBinaryChange(step) {
        function waitFormMlModelEndpoint() {
            var params = {
                MLModelId: modelId,
            };
            mL.getMLModel(params, function (err, data) {
                if (err) { console.log(err, err.stack); }
                else {
                    if (data.EndpointInfo.EndpointStatus !== 'READY') {
                        console.log('Step 14: Endpoint is ' + data.EndpointInfo.EndpointStatus + ', waiting 30 sec...');
                        sleep.sleep(30);
                        waitFormMlModelEndpoint();
                    } else {
                        sleep.sleep(60); // sleep an xtra 60 sec to fix an aws bug
                        predDate = moment().add(1, 'days');
                        var params = {
                            MLModelId: modelId,
                            PredictEndpoint: predictionEndpoint,
                            Record: {
                                'date': predDate.format("YYYY-MM-DD"),
                                //'price': currentPrice,
                                'month': predDate.format("M"),
                                'day': predDate.format("D"),
                                'year': predDate.format("YYYY"),
                            }
                        };

                        //console.log('params', params);

                        // predict tomorrow 
                        mL.predict(params, function (err, data) {
                            if (err) { console.log(err, err.stack); }
                            else {

                                //console.log(data);
                                console.log('Step 14: Predict Successful');
                                prediction = data.Prediction.predictedLabel;
                                predictionDirection = (prediction == 1 ? 'Upwards' : 'Downwards');
                                //predictionPosition = (prediction == 1 && )
                                /*if(prediction == 1 && lastPrice < midPoint) {
                                predictionPosition = 'Long Position';
                                } else if(prediction == 0 && lastPrice > midPoint) {
                                predictionPosition = 'Short Position';
                                } else {
                                predictionPosition = 'No Position';
                                }*/
                                predictionScore = data.Prediction.predictedScores;



                                step();
                            }
                        });

                        // predict 2nd day

                        // predict 3rd day


                    }
                }
            });
        }
        waitFormMlModelEndpoint();
    },

    // Step 15 Trading
    function trade(step) {
        console.log('Step 15: Trading, TODO...');
        step();
    },

    // Step 16 sms + Email
    function notify(step) {

        async.series([

            // send sms
            function sendSms(mS) {
                sms.send('+16302175813', 'Dutchess.ai predicts Bitcoin will move ' + predictionDirection + ' from $' + currentPrice + ' for ' + predDate.format("MM/DD/YYYY"), test).then(function () {
                    mS();
                });
            },

            // create campaign
            function createCampaign(mS) {
                var body = {
                    type: "plaintext",
                    recipients: {
                        list_id: listId
                    },
                    settings: {
                        subject_line: 'Dutchess.ai Bitcoin Prediction for ' + predDate.format("MM/DD/YYYY"),
                        preview_text: 'Dutchess.ai predicts Bitcoin will move ' + predictionDirection + ' from $' + currentPrice + ', take ' + predictionPosition + ' ' + predDate.format("MM/DD/YYYY"),
                        title: 'Dutchess.ai - Bitcoin Prediction for ' + predDate.format("MM/DD/YYYY"),
                        from_name: 'Dutchess.ai',
                        reply_to: 'karl.steltenpohl@gmail.com'
                    },
                    tracking: {
                        opens: true
                    }
                };
                mailchimp.post({ path: '/campaigns', body: body })
                    .then(function (result) {
                        console.log('Step 16.1: Create Campaign Successful');
                        campaign = result;
                        mS();
                    })
                    .catch(function (err) {
                        console.log('ERROR', err);
                    });
            },
            // put campaign content
            function putCampaignContent(mS) {
                var plainText = `
Dutchess.ai - Bitcoin Strategy
Predictions for ` + predDate.format("MM/DD/YYYY") + `:
==================================

Bitcoin (GDAX) price change direction prediction for ` + predDate.format("MM/DD/YYYY") + `: 
` + predictionDirection + `

Current Bitcoin (GDAX) Price for ` + moment().format("MM/DD/YYYY") + `:
` + currentPrice + `

Latest available historical quote for ` + latestRowDate.format("MM/DD/YYYY") + `:
Open: ` + openPrice + `  
High: ` + highPrice + `  
Low: ` + lowPrice + `  
Last: ` + lastPrice + `  

What do these numbers mean?
The price change direction prediction is upwards indicating the last price will be higher than the opening price, and downwards if it will be lower.

How are these numbers generated?
This is a black box program that incorporates the following:
- Bitcoin's historical price and Google Trends correlation for the past 100 days
- Prediction of tomorrows change direction using AWS Machine Learning 

==================================

ALL INVESTMENTS INVOLVE RISKS, INCLUDING THE LOSS OF PRINCIPAL INVESTED. PAST PERFORMANCE OF A SECURITY DOES NOT GUARANTEE FUTURE RESULTS OR SUCCESS. DUTCHESS.AI AND KARL STELTENPOHL ARE NOT LIABLE FOR LOSSES OF ANY KIND. 

Copyright © *|CURRENT_YEAR|* *|LIST:COMPANY|*, All rights reserved.
*|IFNOT:ARCHIVE_PAGE|* *|LIST:DESCRIPTION|*

Our mailing address is:
*|LIST_ADDRESS|* *|END:IF|*

Want to change how you receive these emails?
You can ** update your preferences (*|UPDATE_PROFILE|*)
or ** unsubscribe from this list (*|UNSUB|*)`;

                var body = {
                    plain_text: plainText
                };

                mailchimp.put({ path: '/campaigns/' + campaign.id + '/content', body: body })
                    .then(function (result) {
                        //console.log('CONTENT',result);
                        console.log('Step 16.2: Put Campaign Content Successful');
                        mS();
                    })
                    .catch(function (err) {
                        console.log('ERROR', err);
                    });
            },
            // sent tesd email
            function sendTestEmail(mS) {
                var body = {
                    test_emails: ['karl@webksd.com'],
                    send_type: 'plaintext'
                };
                mailchimp.post({ path: '/campaigns/' + campaign.id + '/actions/test', body: body })
                    .then(function (result) {
                        console.log('Step 16.3: Send Test Email Successful');
                        mS();
                    })
                    .catch(function (err) {
                        console.log(err);
                    });
            },
            // send live email
            function sendLiveEmail(mS) {
                if (!test) {
                    mailchimp.post({ path: '/campaigns/' + campaign.id + '/actions/send' })
                        .then(function (result) {
                            console.log('Step 16.4: Send Live Email Successful');
                            step();
                            //mS();
                        })
                        .catch(function (err) {
                            console.log(err);
                        });
                } else {
                    console.log('Step 16.4: Live Email Not Sent');
                    step();
                }
            }
        ], function (err) {
            if (err) {
                console.log('Error: ' + err);
            }
        });
        //}
    },

    // Step 17 cleanup endpoint
    function cleanupEndpoint(step) {
        console.log('Step 17: Cleanup Endpoint');
        var params = { MLModelId: modelId };
        mL.deleteRealtimeEndpoint(params, function (err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                step();
            }
        });
    },

    // Step 18 cleanup model
    function cleanupModel(step) {
        console.log('Step 18: Cleanup Model');
        var params = { MLModelId: modelId };
        mL.deleteMLModel(params, function (err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                step();
            }
        });
    },

    // Step 19 cleanup datasource 1 training
    function cleanupTrainingDataSources(step) {
        console.log('Step 19: Cleanup Datasources');
        var params = {
            DataSourceId: trainingDatasourceId
        };
        mL.deleteDataSource(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                step();
            }
        });
    },

    // Step 20 cleanup datasource 2 evaluation
    function cleanupEvaluationDataSource(step) {
        console.log('Step 20: Cleanup Datasources');
        var params = {
            DataSourceId: trainingDatasourceId
        };
        mL.deleteDataSource(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                step();
            }
        });
    }

], function (err) {
    if (err) {
        console.log('Error: ' + err);
    }
});

function dataSchema(targetField) {
    return JSON.stringify({
        "version": "1.0",
        "targetFieldName": targetField,
        "dataFormat": "CSV",
        "dataFileContainsHeader": true,
        "attributes": [
            { "fieldName": "date", "fieldType": "TEXT" },
            { "fieldName": "interest", "fieldType": "NUMERIC" },
            { "fieldName": "baselinedate", "fieldType": "NUMERIC" },
            { "fieldName": "month", "fieldType": "CATEGORICAL" },
            { "fieldName": "day", "fieldType": "CATEGORICAL" },
            { "fieldName": "year", "fieldType": "CATEGORICAL" },
            { "fieldName": "price", "fieldType": "NUMERIC" },
            { "fieldName": "low", "fieldType": "NUMERIC" },
            { "fieldName": "high", "fieldType": "NUMERIC" },
            { "fieldName": "open", "fieldType": "NUMERIC" },
            { "fieldName": "close", "fieldType": "NUMERIC" },
            { "fieldName": "change", "fieldType": "NUMERIC" },
            { "fieldName": "volume", "fieldType": "NUMERIC" },
            { "fieldName": "winloss", "fieldType": "BINARY" }
        ]
    });
}