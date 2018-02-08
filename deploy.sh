#!/usr/bin/env sh
scp ./config/secrets.json awsnode:./Dutchess.ai/config/secrets.json
scp ./config/sheetsClientSecret.json awsnode:./Dutchess.ai/config/sheetsClientSecret.json
scp ./config/phone-list.json awsnode:./Dutchess.ai/config/phone-list.json
