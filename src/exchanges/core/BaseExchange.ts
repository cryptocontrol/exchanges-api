import * as ccxt from 'ccxt'
import * as _ from 'underscore'

import { EventEmitter } from 'events'
import { IOrderBook, IOrderTypes, IOrderRequest } from 'src/interfaces'
import { OnReadyCallback, ResolutionBackValues, HistoryDepth, GetMarksCallback,
  IExternalDatafeed, IDatafeedChartApi, LibrarySymbolInfo, ServerTimeCallback, ErrorCallback,
  Mark, TimescaleMark, SearchSymbolsCallback, ResolveCallback, HistoryCallback,
  SubscribeBarsCallback, ResolutionString, GetBarsResult
} from '../../datafeed-api'

// import { fetchResponseFromExtension } from 'src/libraries/BrowserExtension'


export type IExchangeFeature = 'view_deposits' | 'view_withdrawals' | 'get_deposit_address' | 'margin_trading'
export type IChartInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h'
| '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M' | '1Y' | 'YTD'


export interface IExchangeAuth {
  key: string
  secret: string
  password?: string
  extra?: object
}

/**
 * This class represents a exchange with functions which can be used with trading view.
 */
abstract class BaseChartableExchange extends EventEmitter implements IExternalDatafeed, IDatafeedChartApi {
  protected readonly exchangeName: string
  protected readonly maxLimit: number
  protected readonly auth?: IExchangeAuth


  public constructor (exchangeName: string, auth?: IExchangeAuth, maxLimit: number = 1000) {
    super()
    this.auth = auth
    this.exchangeName = exchangeName
    this.maxLimit = maxLimit
  }


  protected abstract getSupportedResolutions(): string[]
  protected abstract getHistory (
    ticker: string, resolution: string, rangeStartDate: number,
    rangeEndDate: number): Promise<GetBarsResult>


  onReady (callback: OnReadyCallback): void {
    callback({
      symbols_types: [],
      exchanges: [],
      // supports_search: true,
      // supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: false,
      supported_resolutions: this.getSupportedResolutions()
    })
  }


  calculateHistoryDepth (resolution: ResolutionString): HistoryDepth {
    let newResolutionBack: ResolutionBackValues, newIntervalBack: number

    // go back 1000 units in time
    switch (resolution) {
      default: break
      case '1': newResolutionBack = 'D'; newIntervalBack = 0.5; break
      case '3': newResolutionBack = 'D'; newIntervalBack = 2; break
      case '5': newResolutionBack = 'D'; newIntervalBack = 3; break
      case '15': newResolutionBack = 'D'; newIntervalBack = 10; break
      case '30': newResolutionBack = 'D'; newIntervalBack = 20; break
      case '60': newResolutionBack = 'M'; newIntervalBack = 1; break
      case '120': newResolutionBack = 'M'; newIntervalBack = 2; break
      case '240': newResolutionBack = 'M'; newIntervalBack = 4; break
      case '360': newResolutionBack = 'M'; newIntervalBack = 6; break
      case '480': newResolutionBack = 'M'; newIntervalBack = 8; break
      case '720': newResolutionBack = 'M'; newIntervalBack = 12; break
      case 'D': case '1D': newResolutionBack = 'M'; newIntervalBack = 33; break
      case '3D': newResolutionBack = 'M'; newIntervalBack = 90; break
      case 'W': case '1W': newResolutionBack = 'M'; newIntervalBack = 198; break
      case 'M': newResolutionBack = 'M'; newIntervalBack = 1000; break
    }

    return {
      resolutionBack: newResolutionBack,
      intervalBack: newIntervalBack / (1000 / this.maxLimit)
    }
  }


  getMarks? (
    symbolInfo: LibrarySymbolInfo, from: number, to: number,
    onDataCallback: GetMarksCallback<Mark>, resolution: string): void {
    onDataCallback([])
  }


  getTimescaleMarks? (
    symbolInfo: LibrarySymbolInfo, from: number, to: number,
    onDataCallback: GetMarksCallback<TimescaleMark>, resolution: string): void {
    onDataCallback([])
  }


  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: SearchSymbolsCallback): void {
    onResult([])
  }


  resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: ErrorCallback): void {
    // calculate deciemals to show
    let decimals = 3
    if (symbolName.indexOf('/USD') || symbolName.indexOf('/TUSD')) decimals = 3
    if (symbolName.endsWith('BTC')) decimals = 8
    if (symbolName.endsWith('ETH')) decimals = 8

    const symbol: LibrarySymbolInfo = {
      description: symbolName,
      exchange: this.exchangeName.toUpperCase(),
      listed_exchange: this.exchangeName.toUpperCase(),
      has_intraday: true,
      has_no_volume: false,
      has_seconds: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      minmov: 1,
      name: symbolName,
      full_name: symbolName,
      type: 'pulsed',
      ticker: symbolName,
      pricescale: 10 ** decimals,
      supported_resolutions: this.getSupportedResolutions(),
      session: '24x7',
      timezone: 'America/New_York'
    }

    setTimeout(() => onResolve(symbol), 100)
  }


  getBars (
    symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, rangeStartDate: number,
    rangeEndDate: number, onResult: HistoryCallback, onError: ErrorCallback, isFirstCall: boolean): void {
      this.getHistory(symbolInfo.ticker, resolution, rangeStartDate, rangeEndDate)
      .then((result: GetBarsResult) => onResult(result.bars, result.meta))
      .catch(onError)
  }


  abstract getServerTime?(callback: ServerTimeCallback): void


  abstract subscribeBars (
    symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, onTick: SubscribeBarsCallback,
    listenerGuid: string, onResetCacheNeededCallback: () => void): void


  abstract unsubscribeBars (listenerGuid: string)


  protected sendRequest<T> (url: string, options: any = {}): Promise<T> {
    // nothing
    return fetch(url, options)
    .then(response => {
      if (!response.ok) return response.json().then(json => Promise.reject(json))
      return response.json()
    })
  }
}


export default abstract class BaseExchange extends BaseChartableExchange {
  public readonly id: string
  public readonly name: string

  private readonly emitCache: {[event: string]: any[][]} = {}
  private readonly emitCacheLocks: {[event: string]: boolean} = {}
  private readonly enableThrottle = true
  private readonly throttleInterval = 1000


  constructor (id: string, name: string, auth?: IExchangeAuth, maxLimit?: number) {
    super(name, auth, maxLimit)
    this.id = id
    this.name = name
  }


  public abstract hasFeature (id: IExchangeFeature, symbolOrCurrency?: string): Boolean
  public abstract canTrade (symbolOrCurrency?: string): Boolean
  public abstract allowsSpotTrading (symbol: string): boolean
  public abstract allowsMarginTrading (symbol: string): boolean

  public abstract initialise (): Promise<void>
  public abstract isInitialised (): Boolean

  public abstract streamTrades (symbol: string): void
  public abstract streamOrderbook (symbol: string): void

  public abstract stopStreamingTrades (symbol: string): void
  public abstract stopStreamingOrderbook (symbol: string): void

  // public abstract loadMarkets (): void
  // public abstract fetchMarkets (): void
  // public abstract fetchTickers (symbol: string): void

  public getSupportedOrderTypes (symbol: string): IOrderTypes[] { return ['limit', 'market'] }

  /* Margin trading functions */
  public abstract getOpenPositions (symbol: string)
  public abstract getClosedPositions (symbol: string)
  public abstract getAllPositions (symbol: string)
  public abstract closePosition (exchageId: string, positions: any, kind: any, price?: number)


  // public abstract executeSpotOrder (order: IOrderRequest): ccxt.Order
  // public abstract executePaperOrder (order: IOrderRequest): ccxt.Order
  // public abstract cancelOrder (orderId: string): ccxt.Order

  public abstract getTrades (symbol: string, since?: number, descending?: boolean): Promise<ccxt.Trade[]>
  public abstract getOrderbook (symbol: string): Promise<IOrderBook>
  // public abstract createMarginOrder (symbol: string)
  // public abstract createSpotOrder (symbol: string)
  // public abstract createPaperOrder (symbol: string)

  /* private methods */
  public abstract getUserBalance (): Promise<ccxt.Balances>
  public abstract getOpenOrders (symbol: string): Promise<ccxt.Order[]>
  public abstract getClosedOrders (symbol: string): Promise<ccxt.Order[]>

  public abstract executeOrder (symbol: string, order: IOrderRequest): Promise<ccxt.Order>
  public abstract executeMarginOrder (order: IOrderRequest): ccxt.Order
  public abstract cancelOrder (symbol: string, orderId: string): Promise<Boolean>

  public abstract getMarkets (): {[symbol: string]: ccxt.Market}
  public abstract getTickers (): Promise<{[x: string]: ccxt.Ticker}>

  public abstract getSpotBalance (): Promise<ccxt.Balances>
  public abstract getMarginBalance (): Promise<ccxt.Balances>

  public abstract getDepositTxs (currency?: string, since?: number): Promise<ccxt.Transaction[]>
  public abstract getWithdrawTxs (currency?: string, since?: number): Promise<ccxt.Transaction[]>
  public abstract getDepositAddress (currency: string): Promise<ccxt.DepositAddressResponse>


  public toString () {
    return this.id
  }


  /**
   * A throttled version of the emit function. Sometimes exchanges emit
   * events faster than what our app can update. For that reason, we
   * throttle our requests so that the app has enough time to process requests
   * together.
   */
  protected emitThrottled (event: string, args: any[]) {
    if (!this.enableThrottle) return super.emit(event, args)

    this.emitCache[event] = this.emitCache[event] || []
    this.emitCache[event].push(args)

    if (this.emitCacheLocks[event]) return

    const throttleFn = () => {
      const toPush = this.emitCache[event]
        .reduce(
          (prev, curr) => {
            prev.forEach(p => curr.push(p))
            return curr
          },
          []
        )

      this.emitCache[event] = []
      this.emitCacheLocks[event] = false

      super.emit(event, toPush)
    }

    setTimeout(throttleFn, this.throttleInterval)
    this.emitCacheLocks[event] = true

    return true
  }
}
