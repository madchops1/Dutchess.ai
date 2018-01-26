#!/usr/bin/env sh
scp ./secrets.json awsnode:./Dutchess.ai/secrets.json
scp ./sheetsClientSecret.json awsnode:./Dutchess.ai/sheetsClientSecret.json
scp ./config/phone-list.json awsnode:./Dutchess.ai/config/phone-list.json
