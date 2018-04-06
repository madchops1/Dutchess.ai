/*
  /\_/\
 ( o.o )
  > ^ <
DUTCHESS.AI - "NANANA"
Machine learning component of Nanana.

- Streams BTC or ETH or LTC forever
- Calculates momentum between ticks
- when we get x positive momentum reads buy in
- then wait until we get x down tick b4 selling
forever start -o ~/Dutchess.ai/.tmp/nanana.out.log -e ~/Dutchess.ai/.tmp/nanana.err.log nanana.js

NOTES:
Nanana is the current prod momentum algo trader. The 3rd iteration of my algo traders

- I'm going to add some machine learnivng to the Nanana algo today 2/27/18
- Currently 

Add the training data to the training sheet every sell
Build another program that:
 1. Kills the nanana.js script. Or nanana.js can kill itself after its last sell after a certian time
 2. Retrains the machine learning models for nanana daily
 3. Restarts the nanana.js script with the new endpoint

2/5/18
Instead of restarting the nanana.js script...
...I can just write the endpoint to a .tmp file and then get it from that .tmp file

2/6/18
This will be executed by the nanana.js script each time it sells
So we good biotch
*/

// Dependencies
const constants = require('./lib/_constants.js');
const json2csv = require('json2csv');
const async = require('async');
const moment = require('moment');
const axios = require('axios');
const sleep = require('sleep');
const clone = require('clone');
const scraperjs = require('scraperjs');
const GoogleSpreadsheet = require('google-spreadsheet');
const secrets = require(constants.CONFIG + '/secrets.json');
const args = process.argv.slice(2);
const request = require('request');
const AWS = require('aws-sdk');
const uuid = require('node-uuid');
const mL = new AWS.MachineLearning({ region: 'us-east-1' });
const creds = require(constants.CONFIG + '/sheetsClientSecret.json');
const sheetId = secrets.NananaMlSheetId;
const doc = new GoogleSpreadsheet(sheetId);
const bucketName = secrets.NananaBucketName;
const fs = require('fs');

let keyName = 'data-' + moment().format('YYYY-MM-DD') + '.csv';

let test = false;
if (args[0] === 'test') {
    test = true;
}

let sheet;
let jsonData;
let csvData;
let endopointJsonData;
let endpointFilePath = constants.TMP + '/nanana/endpoint.json';

let trainingDatasourceId;
let evaluationDatasourceId;
let modelId;
let evaluationId;
let predictionEndpoint;

let dataSchema = JSON.stringify({
    version: '1.0',
    targetFieldName: 'status',
    dataFormat: 'CSV',
    dataFileContainsHeader: true,
    attributes: [
        { fieldName: 'time', fieldType: 'TEXT' },
        { fieldName: 'price', fieldType: 'NUMERIC' },
        { fieldName: 'open', fieldType: 'NUMERIC' },
        { fieldName: 'high', fieldType: 'NUMERIC' },
        { fieldName: 'low', fieldType: 'NUMERIC' },
        { fieldName: 'volume', fieldType: 'NUMERIC' },
        { fieldName: 'lastSvl', fieldType: 'NUMERIC' },
        { fieldName: 'currentSvl', fieldType: 'NUMERIC' },
        { fieldName: 'rocAlpha', fieldType: 'NUMERIC' },
        { fieldName: 'rocBeta', fieldType: 'NUMERIC' },
        { fieldName: 'status', fieldType: 'BINARY' }
    ]
});

async.series(
    [
        // cleanup old endpoin
        /*
    function cleanup(step) {
        // get json file
        // delete data sources, delete endpoint, delete, eval, delete model...
    },
    */

        // Step 1 Authenticate training sheet
        function authenticateTrainingSheet(step) {
            console.log('Step 1: Authenticated Google Sheets');
            doc.useServiceAccountAuth(creds, step);
        },

        // Step 2 Get sheet info
        function getInfoAndWorksheets(step) {
            doc.getInfo(function(err, info) {
                sheet = info.worksheets[0];
                console.log('Step 2: Get Sheet Successful, ' + sheet.rowCount + ' rows');
                step();
            });
        },

        // Step 3 get all rows
        function getAllRows(step) {
            sheet.getRows({ offset: 1, limit: sheet.rowCount }, function(err, rows) {
                jsonData = clone(rows);
                for (var k in jsonData) {
                    delete jsonData[k].id;
                    delete jsonData[k]._xml;
                    delete jsonData[k]['app:edited'];
                    delete jsonData[k]._links;
                    delete jsonData[k].save;
                    delete jsonData[k].del;
                }
                console.log('Step 3: Get All Rows Successful');
                step();
            });
        },

        // Step 4 convert to csv
        function convertDataToCsv(step) {
            //console.log("ALPHA", Object.keys(jsonData[0]));
            json2csv({ data: jsonData, fields: Object.keys(jsonData[0]) }, function(err, csv) {
                if (err) {
                    console.log(err);
                }
                console.log('Step 4: Convert Data To CSV Successfull');
                csvData = csv;
                step();
            });
        },

        // Step 5 upload to s3
        function uploadCsvToS3(step) {
            var s3 = new AWS.S3();
            var params = { Bucket: bucketName, Key: keyName, Body: csvData };
            s3.putObject(params, function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    console.log('Step 5: Successfully Uploaded Data To ' + bucketName + '/' + keyName);
                }
                step();
            });
        },

        // Step 5 create training datasource
        function createMlTrainingDatasource(step) {
            trainingDatasourceId = 'nanana-train-ds-' + uuid.v4() + '';
            var params = {
                DataSourceId: trainingDatasourceId,
                DataSpec: {
                    DataLocationS3: 's3://' + bucketName + '/' + keyName,
                    DataRearrangement: '{"splitting":{"percentBegin":0, "percentEnd":50, "strategy":"random"}}',
                    DataSchema: dataSchema
                },
                ComputeStatistics: true,
                DataSourceName: 'Nanana Strategy Training 0-50 ' + moment().format('YYYY-MM-DD')
            };

            mL.createDataSourceFromS3(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    // an error occurred
                    console.log('Step 5: Create Testing Datasource Successfull');
                    step();
                }
            });
        },

        // Step 6 create evaluation datasource
        function createMlEvaluationDatasource(step) {
            evaluationDatasourceId = 'nanana-eval-ds-' + uuid.v4() + '';
            var params = {
                DataSourceId: evaluationDatasourceId,
                DataSpec: {
                    DataLocationS3: 's3://' + bucketName + '/' + keyName,
                    DataRearrangement: '{"splitting":{"percentBegin":50, "percentEnd":100, "strategy":"random"}}',
                    DataSchema: dataSchema
                },
                ComputeStatistics: true,
                DataSourceName: 'Nana Strategy Evaluation 50-100 ' + moment().format('YYYY-MM-DD')
            };

            mL.createDataSourceFromS3(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    // an error occurred
                    console.log('Step 6: Create Evaluation Datasource Successfull');
                    step();
                }
            });
        },

        // Step 7 create the model
        function createMlModel(step) {
            modelId = 'nanana-model-' + uuid.v4() + '';
            var params = {
                MLModelId: modelId,
                MLModelType: 'BINARY',
                TrainingDataSourceId: trainingDatasourceId,
                MLModelName: 'Nanana Strategy Model ' + moment().format('YYYY-MM-DD'),
                Parameters: {
                    'sgd.shuffleType': 'auto'
                }
            };
            mL.createMLModel(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    console.log('Step 7: Create Machine Learning Model Successful');
                    step();
                }
            });
        },

        // Step 8 create realtime trading endpoint
        function createMlRealtimePredictionEndpoint(step) {
            function waitForMlModel() {
                var params = {
                    MLModelId: modelId
                };
                mL.getMLModel(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    } else {
                        if (data.Status !== 'COMPLETED') {
                            console.log('Step 8: Machine Learning Model is ' + data.Status + ', waiting 30 sec...');
                            sleep.sleep(30);
                            waitForMlModel();
                        } else {
                            console.log('Step 8: Machine Learning Model Status: COMPLETED');
                            var params = { MLModelId: modelId };
                            mL.createRealtimeEndpoint(params, function(err, data) {
                                if (err) {
                                    console.log(err, err.stack);
                                } else {
                                    //console.log(data);
                                    predictionEndpoint = data.RealtimeEndpointInfo.EndpointUrl;
                                    console.log('Step 8.1: Realtime Prediction Endpoint Created Successfully');
                                    step();
                                }
                            });
                        }
                    }
                });
            }
            waitForMlModel();
        },

        // Step 9 write modelId, and endpoint to file
        function writeEndpointData(step) {
            endopointJsonData = {
                trainingDatasourceId: trainingDatasourceId,
                evaluationDatasourceId: evaluationDatasourceId,
                modelId: modelId,
                endpoint: predictionEndpoint
            };

            body = JSON.stringify(endopointJsonData);
            fs.writeFile(endpointFilePath, body, 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                }
                console.log('DONE');
                process.exit(1);
            });
        }
    ],
    function(err) {
        if (err) {
            console.log(err);
        }
    }
);
