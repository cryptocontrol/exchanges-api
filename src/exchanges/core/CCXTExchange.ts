import * as _ from 'underscore'
import * as ccxt from 'ccxt'

import BaseExchange, { IExchangeFeature, IChartInterval, IExchangeAuth } from './BaseExchange'
import { IOrderBook, IOrderRequest } from 'src/interfaces'
import { ServerTimeCallback, LibrarySymbolInfo, SubscribeBarsCallback, GetBarsResult } from '../../datafeed-api'



export default class CCXTExchange extends BaseExchange {
  protected readonly exchange: ccxt.Exchange
  private readonly tradeTimeouts: { [symbol: string]: number } = {}
  private readonly orderbookTimeouts: { [symbol: string]: number } = {}


  constructor (exchange: ccxt.Exchange, auth?: IExchangeAuth, maxLimit?: number) {
    super(exchange.id, exchange.name, auth, maxLimit)
    this.exchange = exchange
  }


  public isInitialised (): boolean {
    return !!this.exchange.markets
  }


  public async initialise () {
    await this.exchange.loadMarkets().then(() => this.emit('init'))
  }


  public hasFeature(id: IExchangeFeature, symbolOrCurrency?: string): Boolean {
    if (id === 'view_deposits') return this.exchange.has.fetchDeposits
    if (id === 'view_withdrawals') return this.exchange.has.fe
  }


  public canTrade (symbolOrCurrency?: string): Boolean {
    return this.exchange.market(symbolOrCurrency).active
  }


  /**
   * The CCXT version of streaming orderbook is a polling fn.
   */
  public streamOrderbook(symbol: string) {
    const interval = setInterval(
      async () => {
        const orderbook = await this.exchange.fetchOrderBook(symbol)
        const mappedOrderbook: IOrderBook = {
          bids: orderbook.bids.map(a => { return { price: a[0], amount: a[1] }}),
          asks: orderbook.asks.map(a => { return { price: a[0], amount: a[1] }})
        }
        this.emit(`orderbook:full:${symbol}`, mappedOrderbook)
      },
      this.exchange.rateLimit * 3
    )

    this.tradeTimeouts[symbol] = Number(interval)
  }


  /**
   * The CCXT version of streaming trades is a polling fn.
   */
  public streamTrades (symbol: string) {
    const interval = setInterval(
      async () => {
        const trades = await this.exchange.fetchTrades(symbol)
        this.emit(`trade:full:${symbol}`, trades)
      },
      this.exchange.rateLimit * 3
    )

    this.tradeTimeouts[symbol] = Number(interval)
  }


  public getOpenPositions(symbol: string) {
    // throw new Error("Method not implemented.")
  }

  public getClosedPositions(symbol: string) {
    // throw new Error("Method not implemented.")
  }

  public getAllPositions(symbol: string) {
    // throw new Error("Method not implemented.")
  }

  public closePosition (exchageId: string, positions: any, kind: any, price?: number) {
    // throw new Error("Method not implemented.")
  }


  public async getTrades (symbol: string, since?: number, descending?: boolean) {
    return await this.exchange.fetchTrades(symbol, since)
  }


  public async getOrderbook (symbol: string) {
    // get the orderbook
    const orderbook = await this.exchange.fetchOrderBook(symbol)
    const mappedOrderbook: IOrderBook = {
      bids: orderbook.bids.map(a => { return { price: a[0], amount: a[1] }}),
      asks: orderbook.asks.map(a => { return { price: a[0], amount: a[1] }})
    }

    return mappedOrderbook
  }


  public async stopStreamingOrderbook (symbol: string) {
    if (!this.tradeTimeouts[symbol]) return
    clearInterval(this.tradeTimeouts[symbol])
    delete this.tradeTimeouts[symbol]
  }


  public async stopStreamingTrades (symbol: string) {
    if (!this.orderbookTimeouts[symbol]) return
    clearInterval(this.orderbookTimeouts[symbol])
    delete this.orderbookTimeouts[symbol]
  }


  protected getSupportedResolutions(): string[] {
    // throw new Error("Method not implemented.")
    return ['D']
  }


  protected async getHistory(
    ticker: string, resolution: string, rangeStartDate: number,
    rangeEndDate: number): Promise<GetBarsResult> {
    const ohlcv = await this.exchange.fetchOHLCV(ticker, '1d', rangeStartDate, 1000)
    return {
      bars: this.exchange.convertOHLCVToTradingView(ohlcv),
      meta: {
        noData: true
      }
    }
  }


  getServerTime?(callback: ServerTimeCallback): void {
    // throw new Error("Method not implemented.")
  }


  subscribeBars(
    symbolInfo: LibrarySymbolInfo, resolution: string,
    onTick: SubscribeBarsCallback, listenerGuid: string, onResetCacheNeededCallback: () => void): void {
    // throw new Error("Method not implemented.")
  }


  unsubscribeBars(listenerGuid: string) {
    // throw new Error("Method not implemented.")
  }


  public async executeOrder (symbol: string, order: IOrderRequest): Promise<ccxt.Order> {
    this.exchange.enableRateLimit = false
    const ccxtOrder = await this.exchange.createOrder(
      symbol, order.kind.toLowerCase(),
      order.side, order.amount,
      order.price
    )
    this.exchange.enableRateLimit = true

    // Analytics.trackTrade(
    //   baseAsset, quoteAsset,
    //   exchange.id, order.quantity, order.action, order.kind.toLowerCase(), limitPrice
    // )

    return ccxtOrder
  }


  public allowsSpotTrading (symbol: string): boolean {
    return true
  }


  public allowsMarginTrading (symbol: string): boolean {
    return false
  }


  public executeMarginOrder (order: IOrderRequest): ccxt.Order {
    throw new Error('not implemented')
  }


  public async cancelOrder (symbol: string, orderId: string): Promise<Boolean> {
    try {
      this.exchange.enableRateLimit = false
      await this.exchange.cancelOrder(orderId, symbol)
      this.exchange.enableRateLimit = true
    } catch (e) {
      return false
    }

    return true
  }


  public async getUserBalance (): Promise<ccxt.Balances> {
    this.checkForApiKey()
    return await this.exchange.fetchBalance({ recvWindow: 60000 })
  }


  public async getOpenOrders (symbol: string): Promise<ccxt.Order[]> {
    this.checkForApiKey()
    return await this.exchange.fetchOpenOrders(symbol, 0, 100, { recvWindow: 60000 })
  }


  public async getClosedOrders (symbol: string): Promise<ccxt.Order[]> {
    this.checkForApiKey()
    return await this.exchange.fetchOrders(symbol)
  }


  public getMarkets () {
    // @todo: save into couch db
    // see the code of Exchange.js/loadMarkets
    return this.exchange.markets
  }


  public getTickers () {
    return this.exchange.fetchTickers()
  }


  public getDepositTxs (currency?: string, since?: number): Promise<ccxt.Transaction[]> {
    if (this.exchange.has.fetchDeposits) return this.exchange.fetchDeposits(currency, since)
  }


  public getWithdrawTxs(currency?: string, since?: number): Promise<ccxt.Transaction[]> {
    if (this.exchange.has.fetchDeposits) return this.exchange.fetchDeposits(currency, since)
  }


  public getDepositAddress(currency: string): Promise<ccxt.DepositAddressResponse> {
    if (this.exchange.has.fetchDepositAddress) return this.exchange.fetchDepositAddress(currency)
  }


  public getOHLVC(symbol: string, interval: IChartInterval, from?: number, to?: number): Promise<ccxt.OHLCV[]> {
    return this.exchange.fetchOHLCV(symbol, interval, from)
  }


  public getSpotBalance(): Promise<ccxt.Balances> {
    return this.exchange.fetchBalance()
  }


  public getMarginBalance(): Promise<ccxt.Balances> {
    throw new Error('Method not implemented')
  }


  public getCCXTExchange () {
    return this.exchange
  }


  public getMarketId = (symbol: string) => {
    return this.exchange.marketId(symbol)
  }


  private checkForApiKey () {
    if (!this.exchange.apiKey) throw new Error('api key is missing')
  }
}
