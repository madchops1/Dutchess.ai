# Dutchess.ai

A suite of nodejs black boxes for alogorithmic and machine learning supported trading. All named after cats.

## Get Started

    npm install

## AWS Configuration

You need to set up your AWS security credentials before the sample code is able
to connect to AWS. You can do this by creating a file named "credentials" at ~/.aws/
(C:\Users\USER_NAME\.aws\ for Windows users) and saving the following lines in the file:

```
[default]
aws_access_key_id = <your access key id>
aws_secret_access_key = <your secret key>
```

See the [Security Credentials](http://aws.amazon.com/security-credentials) page.
It's also possible to configure your credentials via a configuration file or
directly in source. See the AWS SDK for Node.js [Developer Guide](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html)
for more information.

# Running the black boxes

## Indicators

    node princess.js    - Machine learning Oil Futures momentum predictor
    node tiger.js       - Machine learning bitcoin momentum predictor

## Algo Traders w/Fees

    node super-tiger.js - Rotating momentum Bitcoin, Litecoin, and Ether algo trader v1
    node puss.js        - Momentum algo trader v1
    node nanana.dumb.js - Momentum algo trader v2
    node nanana.js      - AI (self-teaching) momentum algo trader v3
    node nanana.ml.js   - nanana.js machine learning component
    node randy.js       - RSI breackout aglo trader
    node bella.js       - Backtest tick data generator
    node nala.js        - Volume and Momentum algo trader
    node nala.ml.js     - nala.js machine learning component (In progress)
    node apoorva.js     - Daily 5 day SMA vs. 20 day SMA momentum algo
    node charlie.js     - Order book analysis (In progress)
    node merlin.js      - Mean revision algo trader

## Algo Traders w/o Fees

    node chuck.js       - Momentum algo trader, limit orders only, no fees
    node chuckV2.js     - Momentum algo trader v2, limit orders only, no fees
    node jameson.js     - Limit order BUY-.35/SELL+.30 algo trader, no fees

## Library

    astro.js            - solar and lunar data api
    fix.js              - Gdax fix trading api
    rsi-ltc.js          - Litecoin RSI api
    sms.js              - AWS sms sender api
    vibe.js             - Gets the seniment/vibe of a string
    vibeNews.js         - Gets the vibe of the news
    vibeTweets.js       - Gets the vibe on twitter

## Data Stores

The Dutchess programs use json files stored in `/.tmp` and Google Sheets as their data stores.

## CRON

Server cron is usually UTC so these times account for the offset. You may need to adjust your cronjobs depending on your location.

```
0 0 * * 1-5 [path]/Dutchess.ai/src/cron/princess.sh
0 5 * * * [path]/Dutchess.ai/src/cron/tiger.sh
0 15 * * 1-5 [path]/Dutchess.ai/src/cron/randy.sh
0 7 * * * [path]/Dutchess.ai/src/cron/apoorva.sh
#*/5 * * * * [path]/Dutchess.ai/src/cron/crontest.sh
```

## AWS Resources

https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MachineLearning.html#predict-property

## Mailchimp Resources

https://www.npmjs.com/package/mailchimp-api-v3
http://developer.mailchimp.com/documentation/mailchimp/reference/campaigns/#action-post_campaigns_campaign_id_actions_send

## TDA Resources

http://apiforums.tdameritrade.com/tda-board/ubbthreads.php

## API Resources

    News        - https://newsapi.org/docs/endpoints/sources
    Twitter     - https://twitter.cm
    Google
    Twillio
    AWS
    Coinbase
    Gdax
    Mailchimp

## Secrets

Config the secrets files accordingly.

### config/secrets.json

```
{
    "GoogleSheetId": "XXX",
    "BucketName": "XXX",
    "TigerBucketName": "XXX",
    "TigerSheetId": "XXX",
    "RandySheetId": "XXX",
    "NananaSheetId": "XXX",
    "NananaMlSheetId": "XXX",
    "NananaBucketName": "XXX",
    "NalaTrainingSheetId": "XXX",
    "NalaBucketName": "XXX",
    "VladSheetId": "XXX",
    "LinxSheetId": "XXX",
    "QuandlApiKey": "XXX",
    "MailchimpApiKey": "XXX",
    "MailchimpListId": "XXX",
    "CoinbaseApiKey": "XXX",
    "CoinbaseApiSecret": "XXX",
    "gDaxApiKey": "XXX",
    "gDaxApiSecret":"XXX",
    "gDaxPassphrase": "XXX",
    "gDaxSandboxApiKey": "XXX",
    "gDaxSandboxApiSecret":"XXX",
    "gDaxSandboxPassphrase": "XXX",
    "twilioSid": "XXX",
    "twilioAuthToken": "XXX",
    "twilioApiKey": "XXX",
    "twilioApiSecret": "XXX",
    "newsApiKey": "XXX",
    "twitterConsumerKey": "XXX",
    "twitterConsumerSecret": "XXX",
    "twitterAccessToken": "XXX",
    "twitterAccessTokenSecret": "XXX"
}
```

## Google Sheets Secrets

Don't forget to share the google sheets with the client_email.

### config/sheetsClientSecret.json

```
{
    "type": "service_account",
    "project_id": "XXXXXXXXXXX",
    "private_key_id": "XXXXXXXXXXX",
    "private_key": "XXXXXXXXXXX",
    "client_email": "XXXXXXXXXXX",
    "client_id": "XXXXXXXXXXX",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://accounts.google.com/o/oauth2/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "XXXXXXXXXXX"
}
```
