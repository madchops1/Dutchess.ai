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

- I'm going to add some machine learning to the Nanana algo today 2/27/18
- Currently 

Add the training data to the training sheet every sell
Build another program that:
 1. Kills the nanana.js script. Or nanana.js can kill itself after its last sell after a certian time
 2. Retrains the machine learning models for nanana daily
 3. Restarts the nanana.js script with the new endpoint
*/