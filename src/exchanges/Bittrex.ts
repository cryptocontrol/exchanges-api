import * as qs from 'querystring'

import { Bar, ResolutionString } from '../datafeed-api'
import CCXTExchange from './core/CCXTExchange'


type IBittrexInterval = 'oneMin' | 'fiveMin' | 'thirtyMin' | 'hour' | 'day'


export default class BittrexExchange extends CCXTExchange {
  getHistory (ticker: string, resolution: ResolutionString, rangeStartDate: number, rangeEndDate: number) {
    let tickInterval = this.resolutionToBittrexResolution(resolution)

    const [baseSymbol, quoteSymbol] = ticker.split('/')

    const startTime = rangeStartDate * 1000
    const endTime = rangeEndDate * 1000

    const query = qs.stringify({
      marketName: `${quoteSymbol}-${baseSymbol}`,
      tickInterval,
      startTime,
      endTime,
      limit: 500
    })
    return this.sendRequest<any>(`https://international.bittrex.com/Api/v2.0/pub/market/GetTicks?${query}`)
    .then(response => {
      const result: any[] = response.result

      const bars: Bar[] = result.map(r => {
        return {
          time: (new Date(r.T).getTime()),
          open: Number(r.O),
          high: Number(r.H),
          low: Number(r.L),
          close: Number(r.C),
          volume: Number(r.V),
        }
      })

      return {
        bars,
        meta: {
          noData: result.length === 0
        }
      }
    })
  }


  getSupportedResolutions(): ResolutionString[] {
    return ['1', '5', '30', '60', 'D']
  }


  private resolutionToBittrexResolution (resolution: ResolutionString): IBittrexInterval {
    switch (resolution) {
      default: case '1': return 'oneMin'
      case '5': return 'fiveMin'
      case '30': return 'thirtyMin'
      case '60': return 'hour'
      case 'D': case '1D': return 'day'
    }
  }
}
