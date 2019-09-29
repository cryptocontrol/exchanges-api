TypeScript CryptoCurrency eXchange Trading Library (T-CCXT)
==================================================

A unified typescript API for all cryptocurrency exchanges, which uses typescript and websockets to interface with a cryptocurrency exchange with support for UDF as well for OHLCV charts. Here are some of the design philosohpies with T-CCXT.

- Support for websockets
- Trades and Partial Orderbooks are streamed as events (using the EventEmitter)
- A unified interface for exchanges with margin accounts
- Support for UDF datafeeds for integrations with TradingView charts


# Why T-CCXT?
Because CCXT has become far too bloated and doesn't support websockets at the moment.


# Example
```
const binance = new Binance()

// console.log all trades from Binance (using websockets)
binance.on('trades:BTC/USDT', console.log)

// once binance is initialized
binance.on('init', () => {
  // stream BTC/USDT trades
  binance.streamTrades('BTC/USDT')
})
```
