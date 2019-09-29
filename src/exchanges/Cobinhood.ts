import * as qs from 'querystring'

import CCXTExchange from './core/CCXTExchange'
import { Bar } from '../datafeed-api'


type ICobinhoodInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '3h'
  | '6h' | '12h' | '1D' | '7D' | '14D' | '1M'


export default class CobinhoodExchange extends CCXTExchange {
  getSupportedResolutions(): string[] {
    return ['5', '15', '30', '60', '180', '360', '720', 'D', 'W', '2W', 'M']
  }


  getHistory (ticker: string, resolution: string, rangeStartDate: number, rangeEndDate: number) {
    let timeframe: ICobinhoodInterval = '15m'

    switch (resolution) {
      default: case '1': timeframe = '1m'; break
      case '5': timeframe = '5m'; break
      case '15': timeframe = '15m'; break
      case '30': timeframe = '30m'; break
      case '60': timeframe = '1h'; break
      case '180': timeframe = '3h'; break
      case '360': timeframe = '6h'; break
      case '720': timeframe = '12h'; break
      case 'D': case '1D': timeframe = '1D'; break
      case 'W': case '1W': timeframe = '7D'; break
      case '2W': timeframe = '14D'; break
      case 'M': case '1M': timeframe = '1M'; break
    }

    const [baseSymbol, quoteSymbol] = ticker.split('/')
    const symbol = `${baseSymbol}-${quoteSymbol}`

    const start = rangeStartDate * 1000
    const end = rangeEndDate * 1000
    const options = { start_time: start, end_time: end, timeframe: timeframe }

    const url = `https://api.cobinhood.com/v1/chart/candles/${symbol}?${qs.stringify(options)}`
    return this.sendRequest<string[]>(url)
    .then(response => {
      const res: any = response
      const data = res.result.candles
      const bars: Bar[] = data.map(r => {
        return {
          time: Number(r.timestamp),
          open: Number(r.open),
          close: Number(r.close),
          high: Number(r.high),
          low: Number(r.low),
          volume: Number(r.volume),
        }
      })

      return {
        bars,
        meta: {
          noData: response.length === 0
        }
      }
    })
  }
}
