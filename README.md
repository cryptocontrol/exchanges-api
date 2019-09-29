TypeScript CryptoCurrency eXchange Trading Library (T-CCXT)
==================================================

A unified typescript API for all cryptocurrency exchanges, which uses typescript and websockets to interface with a cryptocurrency exchange with support for UDF as well for OHLCV charts. Here are some of the design philosohpies with T-CCXT.

- Support for websockets
- Trades and Partial Orderbooks are streamed as events (using the EventEmitter)
- A unified interface for exchanges with margin accounts
- Support for UDF datafeeds for integrations with TradingView charts
