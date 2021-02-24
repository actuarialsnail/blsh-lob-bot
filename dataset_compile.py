import numpy as np
import pandas as pd
import os

# file path
input_path = './lob-databot/binance-eth_btc/'
output_path = './datasets/'

# data specification parameters
max_level = 100  # 0.1% price intervals x 100 -> +-10% price movement, each level has 4 features, bid/ask x price/size
feature_level = 10  # -1% to 1% range
train_pc = 80  # train_pc% training (1-train_pc%) validation split

# create headers
lob_list = []
for side in ['bid', 'ask']:
    for i in range(max_level):
        lob_list.append(side + 'price' + str(i+1))
        lob_list.append(side + 'size' + str(i+1))
header_list = ['timestamp', 'last']
header_list.extend(lob_list)

new_lob_order = []
for i in range(feature_level):
    for side in ['bid', 'ask']:
        new_lob_order.append(side + 'price' + str(i+1))
        new_lob_order.append(side + 'size' + str(i+1))
new_lob_order = ['last'] + new_lob_order

# loop through each csv in folder
for subdir, dirs, files in os.walk(input_path):
    for file in files:
        if file.endswith((".csv")):
            data_path = os.path.join(subdir, file)
            print('processing', data_path)
            filename = os.path.splitext(file)[0]

            # read csv data
            binance_ethbtc = pd.read_csv(
                data_path, names=header_list, index_col='timestamp')

            # sort df by timestamp
            binance_ethbtc.sort_index(inplace=True)

            # reorder columns and filter
            binance_ethbtc = binance_ethbtc[new_lob_order]

            # split by row
            total_rows = len(binance_ethbtc.index)
            split_row = int(total_rows * train_pc/100)
            print('shape:', binance_ethbtc.shape, ' split row:', split_row)
            binance_ethbtc_train = binance_ethbtc.iloc[:split_row, :]
            binance_ethbtc_validate = binance_ethbtc.iloc[split_row:, :]

            # save data as npy
            np.save(output_path + '/train/' + filename +
                    '.npy', binance_ethbtc_train.values)
            np.save(output_path + '/validate/' + filename +
                    '.npy', binance_ethbtc_validate.values)
