
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

    node princess.js
    node tiger.js
    node super-tiger.js
    node puss.js
    node nanana.js

## AWS Resources
https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MachineLearning.html#predict-property

## Mailchimp Resources
https://www.npmjs.com/package/mailchimp-api-v3
http://developer.mailchimp.com/documentation/mailchimp/reference/campaigns/#action-post_campaigns_campaign_id_actions_send

## TDA Resources
http://apiforums.tdameritrade.com/tda-board/ubbthreads.php

## Ideas
- momentum 3 pick, drop when not picked again, keep rolling
- breakout after resistance or support
- ...

## Secrets

### config/secrets.json
{
    "GoogleSheetId": "XXXXXXXXXXX",
    "BucketName": "XXXXXXXXXXX",
    "TigerBucketName": "XXXXXXXXXXX",
    "TigerSheetId": "XXXXXXXXXXXXXXXXXXXXXX",
    "QuandlApiKey": "XXXXXXXXXXX",
    "MailchimpApiKey": "XXXXXXXXXXX-us7",
    "MailchimpListId": "XXXXXXXXXXX",
    "CoinbaseApiKey": "XXXXXXXXXXX",
    "CoinbaseApiSecret": "XXXXXXXXXXX",
    ...
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
    "client_x509_cert_url": "XXXXXXXXXXX",
    ...
}


