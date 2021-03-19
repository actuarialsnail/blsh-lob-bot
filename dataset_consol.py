import os
import numpy as np

train_dir = './datasets/train/'
validate_dir = './datasets/validate/'

files = []
for subdir, dirs, files in os.walk(train_dir):
    files=files

all_arrays = []
for npfile in files:
    all_arrays.append(np.load(os.path.join(train_dir, npfile)))

np.save(train_dir+'binance_dateset_all.npy', np.concatenate(all_arrays))

files = []
for subdir, dirs, files in os.walk(validate_dir):
    files=files

all_arrays = []
for npfile in files:
    all_arrays.append(np.load(os.path.join(validate_dir, npfile)))

np.save(validate_dir+'binance_dateset_all.npy', np.concatenate(all_arrays))