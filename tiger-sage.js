/*
DUTCHESS.AI - "TIGER SAGE STRATEGY"
Black Box AWS Sagemaker Ml Training 
of Historical Bitcoin Price and Google Trends
*/

var secrets           = require('./secrets.json');
var async             = require('async');
var moment            = require('moment');
var json2csv          = require('json2csv');
var sleep             = require('sleep');

// AWS dependencies
var AWS               = require('aws-sdk');
var uuid              = require('node-uuid');

// Coinbase
var Client            = require('coinbase').Client;
var coinbase          = new Client({'apiKey': secrets.CoinbaseApiKey, 'apiSecret': secrets.CoinbaseApiSecret});

// Google Trends
var googleTrends      = require('google-trends-api');

// Google Sheets
var GoogleSpreadsheet = require('google-spreadsheet');
var sheetId           = secrets.TigerSheetId;
var doc               = new GoogleSpreadsheet(sheetId);
var creds             = require('./sheetsClientSecret.json');
var sheet;
var latestRowDate;
var missingData;
var updatedDoc;
var updatedSheet;
var csvData;
var newRows           = [];
var predDate;
var currentPrice;

// S3
var bucketName        = secrets.TigerBucketName;
var keyName           = 'data-' + moment().format("YYYY-MM-DD") + '.csv';

// Mailchimp
//var Mailchimp         = require('mailchimp-api-v3');

// AWS SageMaker Machine Learning 
var mL                = new AWS.MachineLearning({'region': 'us-east-1'});
//var trainingDatasourceId;
//var evaluationDatasourceId;
//var modelId;
//var evaluationId;
//var predictionEndpoint;
//var prediction;
//var predictionScore;
//var predictionDirection;
//var predictionPosition;
/*var dataSchema        = JSON.stringify({
  "version": "1.0",
  "targetFieldName": "change",
  "dataFormat": "CSV",
  "dataFileContainsHeader": true,
  "attributes": [
    { "fieldName": "date", "fieldType": "TEXT" }, 
    { "fieldName": "interest", "fieldType": "NUMERIC" }, 
    { "fieldName": "price", "fieldType": "NUMERIC" }, 
    { "fieldName": "baselinedate", "fieldType": "NUMERIC" }, 
    { "fieldName": "month", "fieldType": "CATEGORICAL" }, 
    { "fieldName": "day", "fieldType": "CATEGORICAL" }, 
    { "fieldName": "year", "fieldType": "CATEGORICAL" }, 
    { "fieldName": "change", "fieldType": "NUMERIC" }
  ]
});*/

// Settings
var days = 60;

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
        doc.getInfo(function(err, info) {
            sheet = info.worksheets[0];
            console.log('Step 2: Get Sheet Successful, ' + sheet.rowCount + ' rows');
            step();
        });
    },

    // Step 3 Clear the sheet, count up then counts down.
    function clearSheet(step) {
        sheet.getRows({ }, function( err, rows ) {
            if(err) { console.log(err); }
            var functions = [];
            var ids = [];
            for(var k in rows) {
                //console.log('K',rows[k].id);
                fun = function(ss) {
                    //console.log('k',k);
                    rows[k].del(function(err) {
                        if(err) { console.log(err); }
                        --k;
                        ss();
                    });
                };
                functions.push(fun);
            }
            async.series(functions, function(err) { if(err) { console.log(err); } console.log('Step X: Clear Sheet Successful'); step(); });
        });
    },
    
    // Step 4 Get past x number of recorded days historical Google Trend Interest
    function getTrendData(step) {
        var startTime = moment().subtract(days,'days').toDate();
        var endTime = moment().toDate();
        //console.log('Starttime',startTime);
        googleTrends.interestOverTime({keyword: 'Bitcoin', startTime: startTime, endTime: endTime})
        .then(function(results) {
            var json = JSON.parse(results);
            missingData = json.default.timelineData;
            console.log('Step 4: Get Historical Google Trends Data Successful,', missingData.length);
            step();
        })
        .catch(function(err){
            console.error(err);
        });
    },

    // Step 5 Get the historical BTC Price Data 
    function getPriceData(step) {
        var functions = [];
        for(var k in missingData) {
            var fun = function(ss) {
                //sleep.sleep(5);
                var date = moment.unix(missingData[k].time).format("YYYY-MM-DD");
                coinbase.getSpotPrice({'currencyPair': 'BTC-USD', 'date': date}, function(err, obj) {
                    
                    //console.log(dots+'\r');
                    process.stdout.write(dots+'\r');
                    dots += '.';
                    
                    if(err) { 
                        missingData[k].price = false;
                        missingData[k].date = false;
                    } else {
                        missingData[k].price = obj.data.amount;
                        missingData[k].date = date;
                    }
                    ++k;
                    ss();
                });
            }
            functions.push(fun);
        }
        k = 0;
        dots = '.';
        async.series(functions, function(err) { if(err) { console.log(err); } console.log('Step 5: Get Price Data Successful'); step(); });
    },

    // Step 6 Add data to the sheet
    function addDataToSheet(step) {
        var functions   = [];
        var data        = missingData;
        var lastPrice   = 0;
        var k = 0;
        while(k < data.length) {
            var date = '---';
            var change;

            if(data[k].date) {
                date = data[k].date.split('-');
            }
            
            if(lastPrice != 0) { 
                change = data[k].price - lastPrice;
            } else {
                change = '';
            }

            var newRow = {
                date:           data[k].date,
                interest:       data[k].value,
                price:          data[k].price,
                baselinedate:   k,
                month:          date[1],
                day:            date[2],
                year:           date[0],
                change:         change
            };
            newRows.push(newRow);
            var fun = function (ss) {
                //console.log(k,newRows[k].date);
                if(newRows[k].date) {
                    sheet.addRow(newRows[k], 
                        function( err ) {
                            if(err) {
                              console.log(err);
                            }
                            ++k;
                            ss();
                        });
                }
            };
            functions.push(fun);
            lastPrice = data[k].price;
            ++k;
        }
        k = 0;
        async.series(functions, function(err) { if(err) { console.log(err); } console.log('Step 6: Push Data To Sheet Successful'); step(); });
    },

    // Step 7 convert to csv
    function convertCsv(step) {
        json2csv({data: newRows, fields: Object.keys(newRows[0])}, function(err, csv) {
            if(err) { console.log(err); }
            console.log('Step 7: Convert Data To CSV Successfull');
            csvData = csv;
            step();
        });
    },

    // Step 8 upload to s3
    function uploadCsvToS3(step) {
        var s3 = new AWS.S3();
        //s3.createBucket({Bucket: bucketName}, function() {
        var params = {Bucket: bucketName, Key: keyName, Body: csvData};
        s3.putObject(params, function(err, data) {
            if (err) {
            console.log(err)
            } else {
            console.log("Step 8: Successfully Uploaded Data To " + bucketName + "/" + keyName);
            }
            step();
        });
        //});
    },

    // Step 9 create training datasource
    function createMlTrainingDatasource(step) {
        trainingDatasourceId = 'tiger-train-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: trainingDatasourceId,
            DataSpec: { 
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":0, "percentEnd":70, "strategy":"random"}}',
                DataSchema: dataSchema,
            },
            ComputeStatistics: true,
            DataSourceName: 'Tiger Strategy Training 0-70 ' + moment().format("YYYY-MM-DD")
        };
        mL.createDataSourceFromS3(params, function(err, data) {
            if (err) { console.log(err, err.stack); } // an error occurred
            else {
            console.log('Step 9: Create Testing Datasource Successfull');
            step();
            } 
        });
    },

    // Step 10 create eval datasource
    function createMlEvaluationDatasource(step) {
        evaluationDatasourceId = 'tiger-eval-datasource-' + uuid.v4() + '';
        var params = {
            DataSourceId: evaluationDatasourceId,
            DataSpec: { 
                DataLocationS3: 's3://' + bucketName + '/' + keyName,
                DataRearrangement: '{"splitting":{"percentBegin":70, "percentEnd":100, "strategy":"random"}}',
                DataSchema: dataSchema,
            },
            ComputeStatistics: true,
            DataSourceName: 'Tiger Strategy Evaluation 70-100 ' + moment().format("YYYY-MM-DD")
        };
        mL.createDataSourceFromS3(params, function(err, data) {
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
            MLModelType: "REGRESSION",
            TrainingDataSourceId: trainingDatasourceId,
            MLModelName: 'Tiger Strategy Model ' + moment().format("YYYY-MM-DD"),
            Parameters: {
                'sgd.shuffleType': 'auto'
            }
        };
        mL.createMLModel(params, function(err, data) {
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
            mL.getMLModel(params, function(err, data) {
                if (err) { console.log(err, err.stack); } 
                else {
                    if(data.Status !== 'COMPLETED') {
                        console.log('Step 12: Machine Learning Model is ' + data.Status + ', waiting 30 sec...');
                        sleep.sleep(30);
                        waitForMlModel();
                    } else {
                        console.log('Step 12: Machine Learning Model Status: COMPLETED');
                        var params = { MLModelId: modelId };
                        mL.createRealtimeEndpoint(params, function(err, data) {
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
        coinbase.getSpotPrice({'currencyPair': 'BTC-USD', 'date': date}, function(err, obj) {
            if(err) { console.log(err); } else {
                currentPrice = obj.data.amount;
                console.log('Step 13: Get Current Bitcoin Price Successful');
                step();
            }
        });
    },

    // Step 14 predict 
    function predict(step) {
        function waitFormMlModelEndpoint() {
            var params = {
                MLModelId: modelId,
            };
            mL.getMLModel(params, function(err, data) {
                if (err) { console.log(err, err.stack); } 
                else {
                    if(data.EndpointInfo.EndpointStatus !== 'READY') {
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
                                'price': currentPrice,
                                'month': predDate.format("M"),
                                'day': predDate.format("D"),
                                'year': predDate.format("YYYY"),
                            }
                        };
                        
                        console.log('params', params);

                        mL.predict(params, function(err, data) {
                            if (err) { console.log(err, err.stack); }
                            else {
                                console.log(data);
                                console.log('Step 14: Predict Successful');
                                step();
                            }
                        });
                    }
                }
            });
        }
        waitFormMlModelEndpoint();
    },

    // Step X Trading
    function trade(step) {
        console.log('Step 15: Trading, TODO...');
        step();
    },

    // Step X Email
    function email(step) {
        console.log('Step 16: Email, TODO...');
        //step();
    }

], function(err){
  if( err ) {
    console.log('Error: '+err);
  }
});
