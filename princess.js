/*
DUTCHESS.AI - "PRINCESS STRATEGY"
- Black Box
- Runs daily @ 8pm 
- QM futures historical analysis (data from QUANDL)
- Get current QM contract from CME
- Google Sheets Datastore
- Prediction of tomorrows change direction using AWS Machine Learning 
- Mailchimp sends email
- Automate trade with TD Ameritrade api
- Place short or long order if direction will cross the avg from previous day.
*/

// Dependencies
var json2csv          = require('json2csv');
var async             = require('async');
var moment            = require('moment');
var axios             = require('axios');
var sleep             = require('sleep');
var clone             = require('clone');
var scraperjs         = require('scraperjs');
var GoogleSpreadsheet = require('google-spreadsheet');
var Mailchimp         = require('mailchimp-api-v3');
var secrets           = require('./secrets.json');

// AWS dependencies
var AWS               = require('aws-sdk');
var uuid              = require('node-uuid');

// Quandl
var quandlApiKey      = secrets.QuandlApiKey;

// Sheets
var sheetId           = secrets.GoogleSheetId;

// S3
var bucketName        = secrets.BucketName;
var keyName           = 'data-' + moment().format("YYYY-MM-DD") + '.csv';

// CME
var contract;

// Data and Sheets Manipulation
var doc               = new GoogleSpreadsheet(sheetId);
var creds             = require('./sheetsClientSecret.json');
var updatedDoc;
var sheet;
var latestRowDate;
var openPrice;
var lastPrice;
var midPoint;
var missingData;
var jsonData;
var csvData;
var predDate;

// Machine Learning 
var mL                = new AWS.MachineLearning({'region': 'us-east-1'});
var trainingDatasourceId;
var evaluationDatasourceId;
var modelId;
var evaluationId;
var predictionEndpoint;
var prediction;
var predictionScore;
var predictionDirection;
var predictionPosition;
var dataSchema        = JSON.stringify({
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
var mailchimpLive     = true;
var mailchimpApiKey   = secrets.MailchimpApiKey;
var listId            = secrets.MailchimpListId;
var mailchimp         = new Mailchimp(mailchimpApiKey);
var campaign;

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

  // Step 3 get latest row
  function getLatestRow(step) {
    //console.log(sheet);
    sheet.getRows({ offset: sheet.rowCount-1, limit: 1 }, function( err, rows ){
      latestRowDate = new moment(rows[0].date);
      console.log('Step 3: Get Latest Row Data Successful, ' + latestRowDate.format("YYYY-MM-DD"));
      step();
    });
  },

  // Step 4 get contract + missing historical data 
  function getMissingData(step) {
    // get contract
    scraperjs.StaticScraper.create('http://www.cmegroup.com/trading/energy/crude-oil/emini-crude-oil_product_calendar_futures.html')
    .scrape(function($) {
        return $("#calendarFuturesProductTable1 > tbody > tr:nth-child(1) > td:nth-child(2)").map(function() {
            return $(this).text();
        }).get();
    })
    .then(function(text) {
      var htmlText = text[0];
      part1 = htmlText.substring(0,3);
      part2 = htmlText.substring(3);
      contract =  part1 + '20' + part2;
      console.log('Step 4.1: Get Contract Successful,', contract);
      // get missing data 
      axios.get('https://www.quandl.com/api/v3/datasets/CME/' + contract + '.json?api_key=' + quandlApiKey + '&start_date='+latestRowDate.add(1,'days').format("YYYY-MM-DD"))
        .then(function (response) {
          missingData = response.data;
          console.log('Step 4.2: Get Missing Historical Data Successful');
          step();
        })
        .catch(function (error) {
          console.log(error);
        });
    });
  },

  // Step 5 add the missing data to the sheet
  function addMissingDataToSheet(step) {
    var functions   = [];
    var newRows     = [];
    var data        = missingData.dataset.data;
    data.reverse();

    var k = 0;
    while(k<data.length) {
      var dateArray = data[k][0].split('-');
      var newRow = {
        Date:     data[k][0],
          Day:    dateArray[2],
          Month:  dateArray[1],
          Year:   dateArray[0],
          Base_Line_Date: (parseInt(sheet.rowCount) + parseInt(k)),
        Open:     data[k][1],
        High:     data[k][2],
        Low:      data[k][3],
        Last:     data[k][4],
        Change:   data[k][5],
        Settle:   data[k][6],
        Volume:   data[k][7],
        Previous_Day_Open_Interest: data[k][8],
          Real_Change: (data[k][1] - data[k][4]),
          Win_Loss: ((data[k][1] - data[k][4]) > 0 ? 1 : 0)
      };

      newRows.push(newRow);
      
      var fun = function (ss) {
        //console.log(k,Date.now());
        sheet.addRow(newRows[k], 
          function( err ) {
            if(err) {
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
    async.series(functions, function(err) { if(err) { console.log(err); } console.log('Step 5: Push Missing Data To Sheet Successful'); step(); });

  },

  // Step 6 auth updated sheet
  function authenticateUpdatedSheet(step) {
    console.log('Step 6: Authenticate Updated Sheet');
    updatedDoc = new GoogleSpreadsheet(sheetId);
    updatedDoc.useServiceAccountAuth(creds, step);
  },

  // Step 7 get the updated sheet
  function getUpdatedSheet(step) {
    updatedDoc.getInfo(function(err, info) {
      if(err) { console.log(err); }
      updatedSheet = info.worksheets[0];
      console.log('Step 7: Get Updated Sheet Successful, ' + updatedSheet.rowCount + ' rows');
      step();
    });
  },

  // Step 8 get all rows
  function getAllRows(step) {
    updatedSheet.getRows({ offset: 1, limit: updatedSheet.rowCount }, function( err, rows ){
      // format data
      jsonData = clone(rows);
      for(var k in jsonData) {
        delete(jsonData[k].id);
        delete(jsonData[k]._xml);
        delete(jsonData[k]['app:edited']);
        delete(jsonData[k]._links);
        delete(jsonData[k].save);
        delete(jsonData[k].del);
        openPrice = jsonData[k].open;
        lastPrice = jsonData[k].last;
      }
      
      var s; // larger number
      var t; // smaller number

      if(openPrice < lastPrice) {
        s = lastPrice;
        t = openPrice;
      } else {
        s = openPrice;
        t = lastPrice;
      }

      midPoint = ((s-t)/2) + parseFloat(t);

      console.log('Step 8: Get All Rows Successfull, open: ' + openPrice + ', last: ' + lastPrice + ', midPoint: ' + midPoint + '');
      step();
    });
  },

  // Step 9 convert to csv
  function convertDataToCsv(step) {
    json2csv({data: jsonData, fields: Object.keys(jsonData[0])}, function(err, csv) {
      if(err) { console.log(err); }
      console.log('Step 9: Convert Data To CSV Successfull');
      csvData = csv;
      step();
    });
  },

  // Step 10 upload to s3
  function uploadCsvToS3(step) {
    var s3 = new AWS.S3();
    //s3.createBucket({Bucket: bucketName}, function() {
    var params = {Bucket: bucketName, Key: keyName, Body: csvData};
    s3.putObject(params, function(err, data) {
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
    
    mL.createDataSourceFromS3(params, function(err, data) {
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
    
    mL.createDataSourceFromS3(params, function(err, data) {
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
    mL.createMLModel(params, function(err, data) {
      if (err) { console.log(err, err.stack); }
      else {
        console.log('Step 13: Create Model Successfull');
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
      mL.getMLModel(params, function(err, data) {
        if (err) { console.log(err, err.stack); } 
        else {
          if(data.Status !== 'COMPLETED') {
            console.log('Step 14: Model is ' + data.Status + ', waiting 30 sec...');
            sleep.sleep(30);
            waitForMlModel();
          } else {
            console.log('Step 14: Model Status: COMPLETED');
            var params = { MLModelId: modelId };
            mL.createRealtimeEndpoint(params, function(err, data) {
              if (err) { console.log(err, err.stack); } 
              else {
                //console.log(data);   
                predictionEndpoint = data.RealtimeEndpointInfo.EndpointUrl;
                console.log('Step 14: Realtime Endpoint Created Successfully');
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
      mL.getMLModel(params, function(err, data) {
        if (err) { console.log(err, err.stack); } 
        else {
          if(data.EndpointInfo.EndpointStatus !== 'READY') {
            console.log('Step 15: Endpoint is ' + data.EndpointInfo.EndpointStatus + ', waiting 30 sec...');
            sleep.sleep(30);
            waitFormMlModelEndpoint();
          } else {
            sleep.sleep(60); // sleep an xtra 60 sec to fix an aws bug
            // get next trading day...
            if(moment().day() === 5) {
              predDate = moment().add(3, 'days');
            } else {
              predDate = moment().add(1, 'days');
            }

            // get the prediction
            var params = {
              MLModelId: modelId,
              PredictEndpoint: predictionEndpoint,
              Record: {
                'date': predDate.format("YYYY-MM-DD"),
                'open': lastPrice
              }
            };
            mL.predict(params, function(err, data) {
              if (err) { console.log(err, err.stack); }
              else {
                //console.log(data);
                prediction = data.Prediction.predictedLabel;
                predictionDirection = (prediction == 1 ? 'Upwards' : 'Downwards');
                //predictionPosition = (prediction == 1 && )
                if(prediction == 1 && lastPrice < midPoint) {
                  predictionPosition = 'Long Position';
                } else if(prediction == 0 && lastPrice > midPoint) {
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
  // get current price
  // get current bid/ask
  // logic for trade
  // execute trade
  function trade(step) {
    console.log('Step 16: Trading, TODO...');
    step();
  },

  // Step 17 create mailchimp campaign, content, test, and send 
  function email(step) {    
    async.series([
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
        mailchimp.post({path: '/campaigns', body: body})
          .then(function(result) {
            console.log('Step 17.1: Create Campaign Successful');
            campaign = result;
            mS();
          })
          .catch(function(err) {
            console.log('ERROR',err);
          });
      },
      // put campaign content
      function putCampaignContent(mS) {
        var plainText = `
Dutchess.ai - Princess Strategy
Predictions for ` + predDate.format("MM/DD/YYYY") + `:
----------------------------------

` + contract + ` Binary Price Change Direction Prediction: 
` + predictionDirection + `

Mid Pivot Point:
$` + midPoint+ `

Suggestion:
` + predictionPosition + `


What do these numbers mean?
----------------------------------

The binary Price Change Direction is upwards if the price change will be higher at end of day and downwards if it will be lower that the last price from the previous day.

Learn more at https://dutchess.ai

==================================

All investments involve risks, including the loss of principal invested. Past performance of a security does not guarantee future results or success. Dutchess.ai, and Karl Steltenpohl are not liable for any losses. 

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
        
        mailchimp.put({path: '/campaigns/' + campaign.id + '/content', body: body })
          .then(function(result) {
            //console.log('CONTENT',result);
            console.log('Step 17.2: Put Campaign Content Successful');
            mS();
          })
          .catch(function(err){
            console.log('ERROR',err);
          });
      },
      // sent tesd email
      function sendTestEmail(mS) {
        var body = {
          test_emails: ['karl@webksd.com'],
          send_type: 'plaintext'
        };
        mailchimp.post({path:'/campaigns/' + campaign.id + '/actions/test', body: body})
          .then(function(result) {
            console.log('Step 17.3: Send Test Email Successful');
            mS();
          })
          .catch(function(err) {
            console.log(err);
          });
      },
      // send live email
      function sendLiveEmail(mS) {
        if(mailchimpLive == true) {
          mailchimp.post({path:'/campaigns/' + campaign.id + '/actions/send'})
            .then(function(result) {
              console.log('Step 17.4: Send Live Email Successful');
              step();
              //mS();
            })
            .catch(function(err) {
              console.log(err);
            });
        } else {
          console.log('Step 17.4: Live Email Not Sent');
          step();
        }  
      }
    ], function(err) {
      if(err) {
        console.log('Error: '+err);
      }
    });

  },

  // Step XX Log completion
  function logCompletion(step) {
    console.log('Step 18: Log, TODO...');
    step();
  },

  // Step XX Cleanup
  function cleanUp(step) {
    console.log('Step 19: Cleanup, TODO...');
    // delete the data.csv from s3 from day before yesterday.
    // basically always keep a backup from prev day
    // delete realtime endpoint
    // delete the model
    // delete the datasources
    //step();

  }
  
], function(err){
  if( err ) {
    console.log('Error: '+err);
  }
});
