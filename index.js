const fetch = require('node-fetch');
const mathjs = require('mathjs');

const ACCESS_TOKEN = 'XXXX-XXXX';
const ENDPOINT = 'https://api-fxpractice.oanda.com';
const STREAM_ENDPOINT = 'https://stream-fxpractice.oanda.com';

function order(units, closePrice) {
  fetch(`${ENDPOINT}/v3/accounts/101-009-14852350-001/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      order: {
        units,
        instrument: 'USD_JPY',
        timeInForce: 'FOK',
        type: 'MARKET',

        positionFill: 'DEFAULT',
        takeProfitOnFill: {
          price: closePrice,
        },
      },
    }),
  }).then(async (response) => {
    console.log(await response.json());
  });
}

// fetch(`${ENDPOINT}/v3/accounts/101-009-14852350-001/trades/5/close`, {
//   method: 'PUT',
//   headers: {
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${ACCESS_TOKEN}`,
//   },
//   body: JSON.stringify({
//     units: '100',
//   }),
// }).then(async (response) => {
//   console.log(await response.json());
// });

const bidsSet = [];
const asksSet = [];
let isReady = false;
fetch(`${STREAM_ENDPOINT}/v3/accounts/101-009-14852350-001/pricing/stream?instruments=USD_JPY`, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  },
}).then(async (response) => {
  response.body.on('data', (data) => {
    const { type, bids, asks, time } = JSON.parse(data.toString());

    if (type === 'PRICE') {
      const second = new Date(time).getSeconds();
      const timeIndex = Math.round(second / 5);

      bidsSet[timeIndex] = parseFloat(bids[0].price);
      asksSet[timeIndex] = parseFloat(asks[0].price);

      if (!isReady) {
        isReady =
          bidsSet.reduce((v) => {
            return v + 1;
          }, 0) >
          60 / 5;

        console.log(bidsSet, asksSet);
      } else {
        const upper = mathjs.mean(bidsSet) + 2 * mathjs.std(bidsSet);
        const lower = mathjs.mean(asksSet) - 2 * mathjs.std(asksSet);
        console.log(lower, '< _ <', upper);

        if (upper <= bidsSet[timeIndex]) {
          closePrice = (mathjs.mean(bidsSet) + 1 * mathjs.std(bidsSet)).toFixed(3);
          order(-1000, closePrice);
          console.log(bidsSet[timeIndex], '売りで注文 →', closePrice);
        }
        if (lower >= asksSet[timeIndex]) {
          closePrice = (mathjs.mean(asksSet) - 1 * mathjs.std(asksSet)).toFixed(3);
          order(1000, closePrice);
          console.log(asksSet[timeIndex], '買いで注文 →', closePrice);
        }
      }
    }
  });
});
