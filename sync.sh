rsync -aP --compare-dest=/home/yi/Documents/arbitor/blsh-lob-bot/lob-databot/binance-eth_btc-archived/  yi@192.168.0.42:/home/yi/lob-databot/logs/ ./lob-databot/binance-eth_btc/
python dataset_compile.py
mv -v ./lob-databot/binance-eth_btc/* ./lob-databot/binance-eth_btc-archived
read
