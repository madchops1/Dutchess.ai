/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "PRINCESS"
- Outputs tomorrows up/down prediction for QM
- Runs daily @ 6pm 
- QM futures historical analysis (data from QUANDL)
- Get current QM contract from CME
- Update Google Sheets Datastore
- Prediction of tomorrows change direction using AWS Machine Learning 
- Cross reference with mid pivot for suggestion
- Mailchimp sends email
- Cleanup AWS 
*/

// Dependencies
const constants = require('./lib/_constants.js');
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

// AWS dependencies
var AWS = require('aws-sdk');
var uuid = require('node-uuid');

const sms = require(constants.LIB + '/sms.js');

// Quandl
var quandlApiKey = secrets.QuandlApiKey;

// Sheets
var sheetId = secrets.GoogleSheetId;

// S3
var bucketName = secrets.BucketName;
var keyName = 'data-' + moment().format("YYYY-MM-DD") + '.csv';

// CME
var contract;

// Data and Sheets Manipulation
var doc = new GoogleSpreadsheet(sheetId);
var creds = require(constants.CONFIG + '/sheetsClientSecret.json');
var updatedDoc;
var sheet;
var latestRowDate;
var openPrice;
var lastPrice;
var lowPrice;
var highPrice;
var midPoint;
var missingData;
var jsonData;
var csvData;
var predDate;

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
var dataSchema = JSON.stringify({
    "version": "1.0",
    "targetFieldName": "winloss",
    "dataFormat": "CSV",
    "dataFileContainsHeader": true,
    "attributes": [
        { "fieldName": "date", "fieldType": "TEXT" },
        { "fieldName": "day", "fieldType": "CATEGORICAL" },
        { "fieldName": "month", "fieldType": "CATEGORICAL" },
        { "fieldName": "year", "fieldType": "CATEGORICAL" },
        { "fieldName": "baselinedate", "fieldType": "NUMERIC" },
        { "fieldName": "open", "fieldType": "NUMERIC" },
        { "fieldName": "high", "fieldType": "NUMERIC" },
        { "fieldName": "low", "fieldType": "NUMERIC" },
        { "fieldName": "last", "fieldType": "NUMERIC" },
        { "fieldName": "change", "fieldType": "NUMERIC" },
        { "fieldName": "settle", "fieldType": "NUMERIC" },
        { "fieldName": "volume", "fieldType": "NUMERIC" },
        { "fieldName": "previousdayopeninterest", "fieldType": "NUMERIC" },
        { "fieldName": "realchange", "fieldType": "NUMERIC" },
        { "fieldName": "winloss", "fieldType": "BINARY" }
    ]
});

// Trading
// @ToDo...

// Mailchimp
var test = false;
if (args[0] === 'test') { test = true; }
var mailchimpApiKey = secrets.MailchimpApiKey;
var listId = secrets.MailchimpListId;
var mailchimp = new Mailchimp(mailchimpApiKey);
var campaign;

async.series([

    // Step 1 Authenticate google sheets
    function setAuth(step) {
        console.log('Step 1: Authenticated Google Sheets');
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

    // Step 3 get latest row
    function getLatestRow(step) {
        //console.log(sheet);
        sheet.getRows({ offset: sheet.rowCount - 1, limit: 1 }, function (err, rows) {
            latestRowDate = new moment(rows[0].date);
            console.log('Step 3: Get Latest Row Data Successful, ' + latestRowDate.format("YYYY-MM-DD"));
            step();
        });
    },

    // Step 4.1 Get contract
    function getContract(step) {
        let i = 1;
        function findContract() {
            scraperjs.StaticScraper.create('http://www.cmegroup.com/trading/energy/crude-oil/emini-crude-oil_product_calendar_futures.html')
                .scrape(function ($) {
                    return $("#calendarFuturesProductTable1 > tbody > tr:nth-child(" + i + ")").map(function () {
                        return $(this).text();
                    }).get();
                })
                .then(function (text) {
                    var text1;
                    var text1Array;
                    text1 = text[0].replace(/(\r\n|\n|\r)/gm, "");
                    text1Array = text1.split("\t");
                    text1Array = text1Array.filter(function (n) { return (n != '' && n != '--') });
                    if (moment().isBefore(moment(text1Array[3], 'DD MMM YYYY'))) {
                        part1 = text1Array[1].substring(0, 3);
                        part2 = text1Array[1].substring(3);
                        contract = part1 + '20' + part2;
                        console.log('Step 4.1: Get Contract Successful,', contract);
                        step();
                    } else {
                        ++i;
                        findContract();
                    }
                });
        }
        findContract();
    },

    // Step 4.2 missing historical data 
    function getMissingData(step) {
        axios.get('https://www.quandl.com/api/v3/datasets/CME/' + contract + '.json?api_key=' + quandlApiKey + '&start_date=' + moment(latestRowDate).add(1, 'days').format("YYYY-MM-DD"))
            .then(function (response) {
                missingData = response.data;
                console.log('Step 4.2: Get Missing Historical Data Successful');
                //console.log('LLLL',latestRowDate.format("MM/DD/YYYY"));

                step();
            })
            .catch(function (error) {
                console.log(error);
            });
    },

    // Step 5 add the missing data to the sheet
    function addMissingDataToSheet(step) {
        var functions = [];
        var newRows = [];
        var data = missingData.dataset.data;
        data.reverse();

        var k = 0;
        while (k < data.length) {
            var dateArray = data[k][0].split('-');
            var newRow = {
                Date: data[k][0],
                Day: dateArray[2],
                Month: dateArray[1],
                Year: dateArray[0],
                Base_Line_Date: (parseInt(sheet.rowCount) + parseInt(k)),
                Open: data[k][1],
                High: data[k][2],
                Low: data[k][3],
                Last: data[k][4],
                Change: data[k][5],
                Settle: data[k][6],
                Volume: data[k][7],
                Previous_Day_Open_Interest: data[k][8],
                Real_Change: (data[k][1] - data[k][4]),
                Win_Loss: ((data[k][1] - data[k][4]) > 0 ? 1 : 0)
            };

            newRows.push(newRow);

            var fun = function (ss) {
                //console.log(k,Date.now());
                sheet.addRow(newRows[k],
                    function (err) {
                        if (err) {
                            console.log(err);
                        }
                        ++k;
                        ss();
                    });
            };

            functions.push(fun);
            ++k;
        }
        k = 0;
        async.series(functions, function (err) { if (err) { console.log(err); } console.log('Step 5: Push Missing Data To Sheet Successful'); step(); });

    },

    // Step 6 auth updated sheet
    function authenticateUpdatedSheet(step) {
        console.log('Step 6: Authenticate Updated Sheet');
        updatedDoc = new GoogleSpreadsheet(sheetId);
        updatedDoc.useServiceAccountAuth(creds, step);
    },

    // Step 7 get the updated sheet
    function getUpdatedSheet(step) {
        updatedDoc.getInfo(function (err, info) {
            if (err) { console.log(err); }
            updatedSheet = info.worksheets[0];
            console.log('Step 7: Get Updated Sheet Successful, ' + updatedSheet.rowCount + ' rows');
            step();
        });
    },

    // Step 8 get all rows
    function getAllRows(step) {
        updatedSheet.getRows({ offset: 1, limit: updatedSheet.rowCount }, function (err, rows) {
            // format data
            jsonData = clone(rows);
            for (var k in jsonData) {
                delete (jsonData[k].id);
                delete (jsonData[k]._xml);
                delete (jsonData[k]['app:edited']);
                delete (jsonData[k]._links);
                delete (jsonData[k].save);
                delete (jsonData[k].del);
                openPrice = jsonData[k].open;
                lastPrice = jsonData[k].last;
                lowPrice = jsonData[k].low;
                highPrice = jsonData[k].high;
                latestRowDate = new moment(rows[k].date); // update latest row date to the latest row with updated data
            }

            var s; // larger number
            var t; // smaller number

            s = highPrice;
            t = lowPrice;

            /*
            if(openPrice < lastPrice) {
              s = lastPrice;
              t = openPrice;
            } else {
              s = openPrice;
              t = lastPrice;
            }
            */

            midPoint = ((s - t) / 2) + parseFloat(t);

            console.log('Step 8: Get All Rows Successfull, ' + latestRowDate.format("MM/DD/YYYY") + ', high: ' + highPrice + ', low: ' + lowPrice + ', midPoint: ' + midPoint + '');
            step();
        });
    },

    // Step 9 convert to csv
    function convertDataToCsv(step) {
        json2csv({ data: jsonData, fields: Object.keys(jsonData[0]) }, function (err, csv) {
            if (err) { console.log(err); }
            console.log('Step 9: Convert Data To CSV Successfull');
            csvData = csv;
            step();
        });
    },

    // Step 10 upload to s3
    function uploadCsvToS3(step) {
        var s3 = new AWS.S3();
        //s3.createBucket({Bucket: bucketName}, function() {
        var params = { Bucket: bucketName, Key: keyName, Body: csvData };
        s3.putObject(params, function (err, data) {
            if (err) {
                console.log(err)
            } else {
                console.log("Step 10: Successfully Uploaded Data To " + bucketName + "/" + keyName);
            }
            step();
        });
        //});
    },

    // Step 11 create training datasource
    function createMlTrainingDatasource(step) {
        trainingDatasourceId = 'princess-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: trainingDatasourceId,
            DataSpec: {
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":0, "percentEnd":70, "strategy":"random"}}',
                DataSchema: dataSchema,
            },
            ComputeStatistics: true,
            DataSourceName: 'Princess Strategy Training 0-70 ' + moment().format("YYYY-MM-DD")
        };

        mL.createDataSourceFromS3(params, function (err, data) {
            if (err) { console.log(err, err.stack); } // an error occurred
            else {
                console.log('Step 11: Create Testing Datasource Successfull');
                step();
            }
        });
    },

    // Step 12 create training datasource
    function createMlTrainingDatasource(step) {
        evaluationDatasourceId = 'princess-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: evaluationDatasourceId,
            DataSpec: {
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":70, "percentEnd":100, "strategy":"random"}}',
                DataSchema: dataSchema,
            },
            ComputeStatistics: true,
            DataSourceName: 'Princess Strategy Evaluation 70-100 ' + moment().format("YYYY-MM-DD")
        };

        mL.createDataSourceFromS3(params, function (err, data) {
            if (err) { console.log(err, err.stack); } // an error occurred
            else {
                console.log('Step 12: Create Evaluation Datasource Successfull');
                step();
            }
        });
    },

    // Step 13 create the model
    function createMlModel(step) {
        modelId = 'princess-model-' + uuid.v4() + '';
        var params = {
            MLModelId: modelId,
            MLModelType: "BINARY",
            TrainingDataSourceId: trainingDatasourceId,
            MLModelName: 'Princess Strategy Model ' + moment().format("YYYY-MM-DD"),
            Parameters: {
                'sgd.shuffleType': 'auto'
            }
        };
        mL.createMLModel(params, function (err, data) {
            if (err) { console.log(err, err.stack); }
            else {
                console.log('Step 13: Create Machine Learning Model Successfull');
                step();
            }
        });
    },

    // Step 14 create realtime trading endpoint
    function createMlRealtimePredictionEndpoint(step) {
        function waitForMlModel() {
            var params = {
                MLModelId: modelId,
            };
            mL.getMLModel(params, function (err, data) {
                if (err) { console.log(err, err.stack); }
                else {
                    if (data.Status !== 'COMPLETED') {
                        console.log('Step 14: Machine Learning Model is ' + data.Status + ', waiting 30 sec...');
                        sleep.sleep(30);
                        waitForMlModel();
                    } else {
                        console.log('Step 14: Machine Learning Model Status: COMPLETED');
                        var params = { MLModelId: modelId };
                        mL.createRealtimeEndpoint(params, function (err, data) {
                            if (err) { console.log(err, err.stack); }
                            else {
                                //console.log(data);   
                                predictionEndpoint = data.RealtimeEndpointInfo.EndpointUrl;
                                console.log('Step 14: Realtime Prediction Endpoint Created Successfully');
                                step();
                            }
                        });
                    }
                }
            });
        }
        waitForMlModel();
    },

    // Step 15 get next trading day's binary change direction indicator
    function predictBinaryChange(step) {
        function waitFormMlModelEndpoint() {
            var params = {
                MLModelId: modelId,
            };
            mL.getMLModel(params, function (err, data) {
                if (err) { console.log(err, err.stack); }
                else {
                    if (data.EndpointInfo.EndpointStatus !== 'READY') {
                        console.log('Step 15: Endpoint is ' + data.EndpointInfo.EndpointStatus + ', waiting 30 sec...');
                        sleep.sleep(30);
                        waitFormMlModelEndpoint();
                    } else {
                        sleep.sleep(60); // sleep an xtra 60 sec to fix an aws bug
                        // get next trading day...

                        //console.log('MMMM', latestRowDate.format("MM/DD/YYYY"));
                        //predDate = latestRowDate;
                        if (latestRowDate.day() === 5) {
                            predDate = moment(latestRowDate).add(3, 'days');
                        } else {
                            predDate = moment(latestRowDate).add(1, 'days');
                        }

                        //console.log('NNNN', latestRowDate.format("MM/DD/YYYY"));

                        // get the prediction
                        var params = {
                            MLModelId: modelId,
                            PredictEndpoint: predictionEndpoint,
                            Record: {
                                'date': predDate.format("YYYY-MM-DD"),
                                'open': lastPrice
                            }
                        };
                        mL.predict(params, function (err, data) {
                            if (err) { console.log(err, err.stack); }
                            else {
                                //console.log(data);
                                prediction = data.Prediction.predictedLabel;
                                predictionDirection = (prediction == 1 ? 'Upwards' : 'Downwards');
                                //predictionPosition = (prediction == 1 && )
                                if (prediction == 1 && lastPrice < midPoint) {
                                    predictionPosition = 'Long Position';
                                } else if (prediction == 0 && lastPrice > midPoint) {
                                    predictionPosition = 'Short Position';
                                } else {
                                    predictionPosition = 'No Position';
                                }
                                predictionScore = data.Prediction.predictedScores;
                                console.log('Step 15: Predict Binary Change Direction Successful, ' + predictionDirection);
                                step();
                            }
                        });

                    }
                }
            });
        }
        waitFormMlModelEndpoint();
    },

    // Step 16 Trading
    // TODO...
    // get current price
    // get current bid/ask
    // logic for trade
    // execute trade
    function trade(step) {
        console.log('Step 16: Trading, TODO...');
        step();
    },

    // Step 17 notify sms and create mailchimp campaign, content, test, and send 
    function notify(step) {

        async.series([
            // sms
            function sendSms(mS) {
                sms.send('+16302175813', 'Dutchess.ai QM/CL prediction: ' + contract + ' will move ' + predictionDirection + ' from $' + lastPrice + ', take ' + predictionPosition + ' for ' + predDate.format("MM/DD/YYYY"), test).then(function () {
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
                        subject_line: 'Dutchess.ai QM/CL Prediction for ' + predDate.format("MM/DD/YYYY"),
                        preview_text: 'Dutchess.ai predicts ' + contract + ' will move ' + predictionDirection + ' from $' + lastPrice + ', take ' + predictionPosition + ' ' + predDate.format("MM/DD/YYYY"),
                        title: 'Dutchess.ai - QM Prediction for ' + predDate.format("MM/DD/YYYY"),
                        from_name: 'Dutchess.ai',
                        reply_to: 'karl.steltenpohl@gmail.com'
                    },
                    tracking: {
                        opens: true
                    }
                };
                mailchimp.post({ path: '/campaigns', body: body })
                    .then(function (result) {
                        console.log('Step 17.1: Create Campaign Successful');
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
Dutchess.ai - QM/CL Strategy
Predictions for ` + predDate.format("MM/DD/YYYY") + `:
==================================

` + contract + ` price change direction prediction for ` + predDate.format("MM/DD/YYYY") + `: 
` + predictionDirection + `

Order suggestion based on prediction + cross reference of mid pivot point for ` + predDate.format("MM/DD/YYYY") + `:
` + predictionPosition + `

Mid pivot point for ` + predDate.format("MM/DD/YYYY") + `:
` + midPoint + `

Latest Quote ` + latestRowDate.format("MM/DD/YYYY") + `:
Open: ` + openPrice + `  
High: ` + highPrice + `  
Low: ` + lowPrice + `  
Last: ` + lastPrice + `  

What do these numbers mean?
The price change direction prediction is upwards indicating the last price will be higher than the opening price, and downwards if it will be lower.

How are these numbers generated?
This is a black box program that incorporates the following:
- QM futures historical price data 2014-Present
- Prediction of tomorrows change direction using AWS Machine Learning 
- If the prediction is in the direction of the mid pivot point then a long or short suggestion is output.

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
                        console.log('Step 17.2: Put Campaign Content Successful');
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
                        console.log('Step 17.3: Send Test Email Successful');
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
                            console.log('Step 17.4: Send Live Email Successful');
                            step();
                            //mS();
                        })
                        .catch(function (err) {
                            console.log(err);
                        });
                } else {
                    console.log('Step 17.4: Live Email Not Sent');
                    step();
                }
            }
        ], function (err) {
            if (err) {
                console.log('Error: ' + err);
            }
        });
    },

    // Step 18 Log completion
    function logCompletion(step) {
        console.log('Step 18: Log, TODO...');
        step();
    },

    // Step 19 cleanup endpoint
    function cleanupEndpoint(step) {
        console.log('Step 19: Cleanup Endpoint');
        var params = { MLModelId: modelId };
        mL.deleteRealtimeEndpoint(params, function (err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                step();
            }
        });
    },

    // Step 20 cleanup model
    function cleanupModel(step) {
        console.log('Step 20: Cleanup Model');
        var params = { MLModelId: modelId };
        mL.deleteMLModel(params, function (err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            } else {
                step();
            }
        });
    },

    // Step 21 cleanup datasource 1 training
    function cleanupTrainingDataSources(step) {
        console.log('Step 21: Cleanup Training Datasource');
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

    // Step 22 cleanup datasource 2 evaluation
    function cleanupEvaluationDataSource(step) {
        console.log('Step 22: Cleanup Evaluation Datasource');
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
