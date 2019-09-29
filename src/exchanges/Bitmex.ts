import * as ccxt from 'ccxt'
import * as qs from 'querystring'
import { BitmexAPI } from 'bitmex-node'

import { Bar, LibrarySymbolInfo, ServerTimeCallback, SubscribeBarsCallback, GetBarsResult,
  ResolutionString } from '../datafeed-api'
import CCXTExchange from './core/CCXTExchange'
import { IOrderTypes } from 'src/interfaces'
import ExchangeManger from 'src/libraries/ExchangeManager'
import { IReduxState } from 'src/modules/reducers'
import { Store } from 'redux'
import { store } from 'src/modules'
import { getCurrentUser } from 'src/modules/auth/reducer'
import { getExchangeKeys } from 'src/modules/dashboard/trading/reducer'


type ICCXTSymbol = string
type IBitmexSymbol = string

type IBitmexInterval = '1' | '5' | '60' | 'D'
type IBitmexHistoryResponse = {
  s: 'ok'
  t: number[]
  o: number[]
  h: number[]
  l: number[]
  v: number[]
  c: number[]
}


export default class BitmexExchange extends CCXTExchange {
  private readonly socket: WebSocket
  private isSocketOpened: boolean = false

  private readonly channelIdToBitmexSymbol: {
    [channelId: number]: IBitmexSymbol
  } = {}

  private readonly streamingTradesChannelIds: {
    [bfxSymbol in IBitmexSymbol]: number
  } = {}

  private readonly streamingOrderbookSymbolChannelIds: {
    [bfxSymbol in IBitmexSymbol]: number
  } = {}


  constructor (exchange: ccxt.Exchange) {
    super(exchange)
    this.socket = new WebSocket('wss://www.bitmex.com/realtime')

    this.socket.onmessage = this.onWebsocketMessage
    this.socket.onclose = _event => { this.isSocketOpened = true }
  }


  getSupportedOrderTypes (symbol: string): IOrderTypes[] {
    return ['limit', 'market', 'stop-limit', 'stop-market', 'take-limit', 'take-market', 'trailing-stop']
  }


  allowsMarginTrading () {
    return true
  }


  allowsSpotTrading () {
    return false
  }


  // public async streamTrades (symbol: string) {
  //   // check if we are already streaming this symbol or not
  //   // if (this.streamingTradesSymbol.indexOf(symbol) >= 0) return
  //   // this.streamingTradesSymbol.push(symbol)

  //   const wsSymbol = this.exchange.marketId(symbol).toUpperCase()

  //   await this.awaitForConnection()
  //   this.socket.send(JSON.stringify({ op: 'subscribe', args: `trade:${wsSymbol}` }))
  // }


  // public async streamOrderbook (symbol: string) {
  //   // const wsSymbol = symbol.replace('/', '').toUpperCase()

  //   await this.awaitForConnection()
  //   this.socket.send(JSON.stringify({ op: 'subscribe', args: `orderBook10:${symbol}` }))
  //   // })

  //   // this.socket.on('message', (orders: any) => {
  //   //   const parsedJSON = JSON.parse(orders)
  //   //   try {
  //   //     const data = parsedJSON.data
  //   //     data.forEach(obj => {
  //   //       const bids: IOrder[] = obj.bids.map(bid => {
  //   //         return {
  //   //           asset: wsSymbol,
  //   //           price: bid[0],
  //   //           amount: bid[1]
  //   //         }
  //   //       })

  //   //       const asks: IOrder[] = obj.asks.map(ask => {
  //   //         return {
  //   //           asset: wsSymbol,
  //   //           price: ask[0],
  //   //           amount: ask[1]
  //   //         }
  //   //       })


  //   //       const orderBook: IOrderBook = { bids, asks }
  //   //       this.emit('orderbook', orderBook)
  //   //     })
  //   //   } catch (e) {
  //   //     // console.log(e)
  //   //   }
  //   // })
  // }


  protected getSupportedResolutions(): string[] {
    return ['1', '5', '15', '30', '60', '180', '360', '720', 'D', '3D', 'W', '2W', 'M']
  }


  protected getHistory(ticker: string, resolution: string, from: number, to: number): Promise<GetBarsResult> {
    const symbol = this.exchange.marketId(ticker)

    const query = {
      to,
      resolution: this.resolutionToBitmexResolution(resolution),
      symbol,
      from,
    }

    const url = `https://www.bitmex.com/api/udf/history?${qs.stringify(query)}`

    return this.sendRequest<IBitmexHistoryResponse>(url)
    .then(response => {
      const bars: Bar[] = response.t.map((r, index) => {
        return {
          time: Number(response.t[index] * 1000),
          open: Number(response.o[index]),
          close: Number(response.c[index]),
          high: Number(response.h[index]),
          low: Number(response.l[index]),
          volume: Number(response.v[index]),
        }
      })

      return {
        bars,
        meta: {
          noData: response.t.length === 0
        }
      }
    })
  }

  getOpenPositions = async () => {
    const apiKeys = this.getExchangeAPIkeysfromStore(store, 'bitmex')
    const bitmex = new BitmexAPI({
      'apiKeyID': apiKeys.apiKey,
      'apiKeySecret': apiKeys.secret
    })

    let positionResult: any = {}
    const positions = await bitmex.Position.get()
    const result1 = await positions.map(res => {
      positionResult.symbol = res.symbol
      positionResult.value = res.lastValue
      positionResult.markPrice = res.lastPrice
      positionResult.entryPrice = res.avgEntryPrice
      positionResult.liqPrice = res.liquidationPrice
      positionResult.size = res.currentQty
      positionResult.currency = res.currency
      positionResult.realisedPnl = res.realisedPnl
      positionResult.unrealisedPnl = res.unrealisedPnl
      positionResult.margin = res.initMargin
      positionResult.crossMargin = res.crossMargin
      // console.log(res)
      return res
    })
    // console.log('r', result1)
    // console.log(positionResult)
    return positionResult
  }


  closePosition = async (exchageId: string, positions: any, kind: any, price?: number) => {
    const exchange = await ExchangeManger.getInstance().getExchange(exchageId)
    const side = positions.size > 0 ? 'sell' : 'buy'
    await exchange.executeOrder(
      positions.symbol,
      {
        side: positions.size > 0 ? 'sell' : 'buy',
        kind,
        market: 'spot',
        amount: positions.size > 0 ? positions.size : positions.size * -1,
        price,
        leverageMultiplier: 0,
      }
    )

  }

  getServerTime?(callback: ServerTimeCallback): void {
    // throw new Error("Method not implemented.");
  }


  subscribeBars(
    symbolInfo: LibrarySymbolInfo, resolution: string, onTick: SubscribeBarsCallback,
    listenerGuid: string, onResetCacheNeededCallback: () => void): void {
    // throw new Error("Method not implemented.");
  }


  unsubscribeBars(listenerGuid: string) {
    // throw new Error("Method not implemented.");
  }


  private getExchangeAPIkeysfromStore (reduxStore: Store<IReduxState>, exchangeId: string) {
    const state = reduxStore.getState()

    const user = getCurrentUser(state)

    if (!user || !user._id) return
    return getExchangeKeys(state, user._id, exchangeId)
  }


  private resolutionToBitmexResolution (resolution: ResolutionString): IBitmexInterval {
    switch (resolution) {
      default: case '1': case '3': return '1'
      case '5': case '15': case '30': return '5'
      case '60': case '180': case '360': case '720': return '60'
      case 'D': case '1D': case 'W': case '1W': case '2W': case 'M': case '1M': return 'D'
    }
  }

  private proccessWebsocketTrades = (trades: any[]) => {
    trades.forEach(obj => {
      const timestamp = Date.parse(obj.timestamp)

      const ccxtTrade: ccxt.Trade = {
        amount: Number(obj.size),
        datetime: (new Date(timestamp)).toISOString(),
        id: String(obj.trdMatchID),
        price: Number(obj.price),
        info: obj,
        timestamp,
        side: obj.side.toLowerCase(),
        symbol: obj.symbol,
        takerOrMaker: 'maker', // trade.maker ? 'maker' : 'taker',
        cost: Number(obj.price) * Number(obj.size),
        fee: undefined
      }

      this.emit(`trade:${obj.symbol}`, ccxtTrade)
    })

  }


  private onWebsocketMessage = async (event: any) => {
    this.isSocketOpened = true

    const data = JSON.parse(event.data)
    if (data.table === 'trade') this.proccessWebsocketTrades(data.data)
  }


  private async awaitForConnection () {
    return new Promise((resolve, reject) => {
      // if socket is closed..
      if (!this.socket) return reject()

      // if already opened
      if (this.isSocketOpened) return resolve()

      // check if the connection is opened every second
      setTimeout(() => { if (this.isSocketOpened) return resolve() }, 1000)

      // if connection doesn't happen in 30s; then we bail
      setTimeout(reject, 30 * 1000)
    })
  }
}
