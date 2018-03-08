# Dutchess.ai

A suite of nodejs black boxes for machine learning and automated trading. All named after cats.

## Get Started

    npm install

## AWS Configuration

You need to set up your AWS security credentials before the sample code is able
to connect to AWS. You can do this by creating a file named "credentials" at ~/.aws/
(C:\Users\USER_NAME\.aws\ for Windows users) and saving the following lines in the file:

    [default]
    aws_access_key_id = <your access key id>
    aws_secret_access_key = <your secret key>

See the [Security Credentials](http://aws.amazon.com/security-credentials) page.
It's also possible to configure your credentials via a configuration file or
directly in source. See the AWS SDK for Node.js [Developer Guide](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html)
for more information.

## Running the black boxes

    node princess.js    - Oil Futures momentum predictor
    node tiger.js       - Machine learning bitcoin momentum predictor
    node super-tiger.js - Rotating momentum algo trader v1
    node puss.js        - Momentum algo trader v1
    node nanana.dumb.js - Momentum algo trader v2
    node nanana.js      - Momentum algo trader v3 w/ machine learning
    node nanana.ml.js   - nanana.js machine learning component
    node randy.js       - RSI breackout aglo trader
    node bella.js       - Backtest tick data generator
    node nala.js        - Volume and Momentum algo trader
    node nala.ml.js     - nala.js machine learning component

## Library

    astro.js            - solar and lunar data api
    fix.js              - Gdax fix trading api
    rsi-ltc.js          - Litecoin RSI api
    sms.js              - AWS sms sender api

## AWS Resources

https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MachineLearning.html#predict-property

## Mailchimp Resources

https://www.npmjs.com/package/mailchimp-api-v3
http://developer.mailchimp.com/documentation/mailchimp/reference/campaigns/#action-post_campaigns_campaign_id_actions_send

## TDA Resources

http://apiforums.tdameritrade.com/tda-board/ubbthreads.php

## Secrets

Config the secrets files accordingly.

### config/secrets.json

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
"twilioApiSecret": "XXX"
}

### config/sheetsClientSecret.json

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
