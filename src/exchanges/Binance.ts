import * as qs from 'querystring'

import { Bar, LibrarySymbolInfo, ServerTimeCallback, SubscribeBarsCallback, ResolutionString } from '../datafeed-api'
import CCXTExchange from './core/CCXTExchange'
import Websocket from '../Websocket'


type IBinanceInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h'
  | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M'


type IBinanceKlineResponse = {
  E: number
  e: string
  s: string
  k: {
    B: string
    c: string
    f: number
    h: string
    i: string
    L: number
    l: string
    n: number
    o: string
    Q: string
    q: string
    s: string
    T: number
    t: number
    V: string
    v: string
    x: number
  }
}


export default class BinanceExchange extends CCXTExchange {
  private readonly streamingKlines: {[symbol: string]: Websocket} = {}


  private readonly marginSymbols = [
    'ETHBTC', 'LTCBTC', 'BNBBTC', 'BTCUSDT', 'ETHUSDT', 'ETCUSDT', 'BTCUSDC', 'LINKUSDT',
    'LINKBTC', 'EOSBTC', 'ETCBTC', 'TRXBTC', 'XRPBTC', 'BNBUSDT', 'ADABTC', 'LTCUSDT',
    'ADAUSDT', 'XRPUSDT', 'EOSUSDT', 'ONTUSDT', 'TRXUSDT', 'ONTBTC'
  ]


  public allowsMarginTrading (symbol: string): boolean {
    // todo: use the binance api to check which symbols have margin trading and which don't
    return this.marginSymbols.indexOf(symbol.replace('/', '')) >= 0
  }


  getHistory (ticker: string, resolution: ResolutionString, rangeStartDate: number, rangeEndDate: number) {
    let interval = this.resolutionToBinanceResolution(resolution)

    const symbol = ticker.replace('/', '')
    const startTime = rangeStartDate * 1000
    const endTime = rangeEndDate * 1000

    const query = {
      symbol,
      interval,
      startTime,
      endTime,
      limit: 1000
    }

    const url = `https://www.binance.com/api/v1/klines?${qs.stringify(query)}`

    return this.sendRequest<string[]>(url)
    .then(response => {
      const bars: Bar[] = response.map(r => {
        return {
          time: Number(r[0]) ,
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        }
      })

      return { bars, meta: { noData: response.length === 0 } }
    })
  }



  getSupportedResolutions(): ResolutionString[] {
    return ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', '720', 'D', '3D', 'W', 'M']
  }


  getServerTime? (callback: ServerTimeCallback): void {
    return
  }


  subscribeBars (
    symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, onTick: SubscribeBarsCallback,
    listenerGuid: string, onResetCacheNeededCallback: () => void): void {

    const wsSymbol = symbolInfo.ticker.replace('/', '').toLowerCase()
    const res = this.resolutionToBinanceResolution(resolution)

    const url = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${res}`

    const socket = new Websocket(url)

    socket.onMessage = data => {
      const message: IBinanceKlineResponse = JSON.parse(data)

      const bar: Bar = {
        time: message.k.t,
        open: Number(message.k.o),
        high: Number(message.k.h),
        low: Number(message.k.l),
        close: Number(message.k.c),
        volume: Number(message.k.v),
      }

      onTick(bar)
    }

    socket.open()

    this.streamingKlines[listenerGuid] = socket
  }


  unsubscribeBars = (listenerGuid: string) => {
    const socket = this.streamingKlines[listenerGuid]
    if (!socket) return

    socket.close()
    delete this.streamingKlines[listenerGuid]
  }


  private resolutionToBinanceResolution (resolution: ResolutionString): IBinanceInterval {
    switch (resolution) {
      default: case '1': return '1m'
      case '3': return '3m'
      case '5': return '5m'
      case '15': return '15m'
      case '30': return '30m'
      case '60': return '1h'
      case '120': return '2h'
      case '240': return '4h'
      case '360': return '6h'
      case '480': return '8h'
      case '720': return '12h'
      case 'D': case '1D': return '1d'
      case '3D': return '3d'
      case 'W': case '1W': return '1w'
      case 'M': case '1M': return '1M'
    }
  }
}
