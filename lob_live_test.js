"use strict";

const Binance = require('node-binance-api');
const ccxt = require('ccxt');
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const { data } = require('@tensorflow/tfjs-node');
const math = require('mathjs');

const symbol = "ETH/BTC";
let orderbook = {}

const level_max = 100 // 50 levels
const level_increment = 0.001 // 0.1% for both bid and ask, 10 bps
const level_increment_digit = 4; // number of digits of the level increment
const price_digit = 6;
const feature_num = 40;
const sample_num = 300;
const predict_num = 30;

let cnn_dataset = [];
let cnn_model;
const load_model = async () => {
    cnn_model = await tf.node.loadSavedModel('./models/2021-01-19_02-10-300_30_0.001/ckpt-loss=0.38-epoch=0100');
}
load_model();

const binance_ws = new Binance().options({});
let binance = new ccxt.binance();

binance_ws.websockets.depthCache(['ETHBTC'], (product, depth) => {
    orderbook[symbol] = depth;
}, 5000);

setInterval(async () => {

    let tmstmp_currentSys = new Date();
    let tmstmp_currentSysDate = tmstmp_currentSys.toJSON().slice(0, 10);
    Promise.all([
        // binance.fetchOrderBook(symbol, 5000),
        binance.fetchTicker(symbol)
    ])
        .then(values => {
            if (orderbook[symbol]) {
                let bids_arr = Object.keys(orderbook[symbol].bids).map(x => [+x, orderbook[symbol].bids[x]]);
                let asks_arr = Object.keys(orderbook[symbol].asks).map(x => [+x, orderbook[symbol].asks[x]]);

                values.unshift({ bids: bids_arr, asks: asks_arr });

                const dataset = build_dataset(values);

                // get the size array from dataset row
                let size_array = []
                dataset.forEach((item, idx) => {
                    if (idx > 2 && (idx + 1) % 2 == 0) size_array.push(item)
                })
                const dataset_mean = math.mean(size_array);
                const dataset_std = math.std(size_array);

                // normalize dataset row
                let normalized_dataset = []
                dataset.forEach((item, idx) => {
                    if (idx > 2 && (idx + 1) % 2 == 0) {
                        normalized_dataset.push((item - dataset_mean) / dataset_std)
                    } else {
                        normalized_dataset.push(item)
                    }
                })
                // console.log(normalized_dataset);
                cnn_dataset.push(normalized_dataset);
                if (cnn_dataset.length > sample_num) {
                    cnn_dataset.shift();
                }

                if (cnn_dataset.length === sample_num) {
                    const tensor = tf.tensor4d(cnn_dataset_create(cnn_dataset));
                    // console.log(tensor.shape);
                    const prediction_array = cnn_model.predict(tensor).arraySync()[0];
                    let prediction_obj = { p_time: dataset[0], p_price: dataset[1], p_best_bid_p: dataset[2], p_best_bid_size: dataset[3], p_ask_bid_p: dataset[level_max * 2 + 2], p_ask_bid_size: dataset[level_max * 2 + 3] };
                    if (prediction_array[0] > 0.9) {
                        prediction_obj.side = "down";
                        console.log(`down prediced in ${predict_num}s, current price ${dataset[1]} at ${dataset[0]}`);
                        forward_test_log(prediction_obj);
                    } else if (prediction_array[2] > 0.9) {
                        prediction_obj.side = "up";
                        console.log(`up prediced in ${predict_num}s, current price ${dataset[1]} at ${dataset[0]}`);
                        forward_test_log(prediction_obj);
                    }
                }
            }
        })
        .catch(error => {
            console.error(error)
        });
}, 1000);

const build_dataset = (data) => {
    let dataset = [];
    let bucketed_lob = {}; bucketed_lob.bids = []; bucketed_lob.asks = [];

    const bids = arr_sort(data[0].bids, false);
    const asks = arr_sort(data[0].asks, true);
    const time = data[1].timestamp;
    const price = data[1].last;
    const best_bid = bids[0];
    const best_ask = asks[0];
    const mid_price = (best_bid[0] + best_ask[0]) / 2;
    const last_bid = bids.slice(-1)[0][0];
    const last_ask = asks.slice(-1)[0][0];
    // console.log('mid', mid_price, 'last', price);
    // console.log('bids', bids, 'asks', asks);

    // if (last_bid / mid_price > level_increment * level_max ||)
    // console.log(last_bid / mid_price);
    // console.log(last_ask / mid_price);

    for (let l = 1; l <= level_max; l++) {
        const bid_pc = 1 - level_increment * l;
        const ask_pc = 1 + level_increment * l
        bucketed_lob.bids.push([Math.floor(mid_price * bid_pc * 10 ** price_digit) / 10 ** price_digit, 0]);
        bucketed_lob.asks.push([Math.floor(mid_price * ask_pc * 10 ** price_digit) / 10 ** price_digit, 0]);
    }
    // console.log(bucketed_lob)

    let raw_size = 0; let residual = 0;
    for (const bid of bids) {
        for (const [bid_level, bid_value] of bucketed_lob.bids.entries()) {
            if (bid[0] >= bid_value[0]) {
                if (bid_level === 0) {
                    bucketed_lob.bids[bid_level][1] += bid[1]
                } else if (bid[0] < bucketed_lob.bids[bid_level - 1][0]) {
                    bucketed_lob.bids[bid_level][1] += bid[1]
                }
            }
        }
        // raw_size += bid[1];
        // if (bid[0] < bucketed_lob.bids[bucketed_lob.bids.length - 1][0]) {
        //     residual += bid[1]
        // }
    }
    // let total_size = 0;
    // bucketed_lob.bids.map(bid => {
    //     total_size += bid[1];
    // })

    // console.log('post', bucketed_lob);
    // console.log(raw_size, total_size, residual);

    for (const ask of asks) {
        for (const [ask_level, ask_value] of bucketed_lob.asks.entries()) {
            if (ask[0] <= ask_value[0]) {
                if (ask_level === 0) {
                    bucketed_lob.asks[ask_level][1] += ask[1]
                } else if (ask[0] > bucketed_lob.asks[ask_level - 1][0]) {
                    bucketed_lob.asks[ask_level][1] += ask[1]
                }
            }
        }

    }

    // console.log('post', bucketed_lob);
    // console.log(bucketed_lob)

    dataset = Object.keys(bucketed_lob).map(level => {
        return bucketed_lob[level].reduce(
            (accumulator, currentValue) => accumulator.concat(currentValue),
            []
        )
    })

    dataset.unshift(time, price)

    return dataset.reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        []
    );
}

const arr_sort = (arr, ascend) => {
    return arr.sort((a, b) => {
        return ascend ? a[0] - b[0] : b[0] - a[0];
    })
}

const cnn_dataset_create = (sample_array) => {
    let cnn = [];
    sample_array.forEach(row => {
        cnn.push(row.slice(2, 2 + feature_num).map(x => [+x])); // convert to number and add 4th dimension [x]
    });
    return [cnn]
}

const forward_test_log = (prediction_obj) => {
    setTimeout(async () => {
        let ticker = await binance.fetchTicker(symbol);
        let delta = ticker.last / prediction_obj.p_price - 1;
        let tmstmp_currentSys = new Date();
        let tmstmp_currentSysDate = tmstmp_currentSys.toJSON().slice(0, 10);
        let log = { time: tmstmp_currentSys, delta, ticker_ask: ticker.ask, ticker_bid: ticker.bid, ticker_last: ticker.last, prediction_obj };
        let score = 0;
        if (prediction_obj.side === 'down' && delta < 0) {
            score = 1;
        } else if (prediction_obj.side === 'up' && delta > 0) {
            score = 1;
        }
        fs.appendFile('./logs/binance_validationlog_' + tmstmp_currentSysDate + '.json', JSON.stringify(log) + '\n', (err) => {
            if (err) { console.log('error writing log files', err) }
        })
        fs.appendFile('./logs/binance_validationscore_' + tmstmp_currentSysDate + '.json', score + ',', (err) => {
            if (err) { console.log('error writing log files', err) }
        })
    }, predict_num * 1000)
}