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
            binance_ethbtc = binance_ethbtc[new_lob_order].dropna()

            # normalize each row
            df_array = binance_ethbtc.values
            norm_df_array = []

            for row in df_array:
                # determine size_array
                size_array = []
                for idx, item in enumerate(row):
                    if (idx > 1 and idx % 2 == 0):
                        size_array.append(item)
                size_mean = np.mean(size_array)
                size_std = np.std(size_array)
                # normalize size_array
                norm_row = []
                for idx, item in enumerate(row):
                    if (idx > 1 and idx % 2 == 0):
                        norm_row.append((item - size_mean)/size_std)
                    else:
                        norm_row.append(item)
                norm_df_array.append(norm_row)

            total_rows = len(norm_df_array)
            split_row = int(total_rows * train_pc/100)
            print('shape:', len(norm_df_array), ' split row:', split_row)
            np_norm_array = np.array(norm_df_array)

            # save data as npy
            np.save(output_path + '/train/' + filename +
                    '.npy', np_norm_array[:split_row, :])
            np.save(output_path + '/validate/' + filename +
                    '.npy', np_norm_array[split_row:, :])
