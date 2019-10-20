import * as ccxt from 'ccxt'
import * as qs from 'querystring'

import CCXTExchange from './core/CCXTExchange'
import { Bar, ResolutionString, HistoryDepth, ResolutionBackValues } from '../datafeed-api'

type ICoinbaseInterval = '60' | '300' | '900' | '3600' | '21600'
  | '86400'


export default class CoinbasePrimeExchange extends CCXTExchange {
  getHistory (ticker: string, resolution: ResolutionString, rangeStartDate: number, rangeEndDate: number) {
    const symbol = this.exchange.marketId(ticker)

    const query = qs.stringify({
      granularity: this.resolutionToCoinbaseProResolution(resolution),
      start: new Date(rangeStartDate * 1000).toISOString(),
      end: new Date(rangeEndDate * 1000).toISOString(),
    })

    return this.sendRequest<number[][]>(`https://api.prime.coinbase.com/products/${symbol}/candles?${query}`)
    .then(response  => {
      const bars: Bar[] = response.map(q => {
        return {
          time: Number(q[0] * 1000),
          low: Number(q[1]),
          high: Number(q[2]),
          open: Number(q[3]),
          close: Number(q[4]),
          volume: Number(q[5]),
        }
      }).reverse()

      return {
        bars,
        meta: {
          noData: response.length === 0
        }
      }
    })
  }


  getSupportedResolutions(): ResolutionString[] {
    return ['1', '5', '15', '60', '360', 'D']
  }



  calculateHistoryDepth (resolution: ResolutionString): HistoryDepth {
    let newResolutionBack: ResolutionBackValues, newIntervalBack: number

    // go back 1000 units in time
    switch (resolution) {
      default: break
      case '1': newResolutionBack = 'D'; newIntervalBack = 250 / 1440; break
      case '5': newResolutionBack = 'D'; newIntervalBack = 1; break
      case '15': newResolutionBack = 'D'; newIntervalBack = 3; break
      case '60': newResolutionBack = 'D'; newIntervalBack = 12; break
      case '360': newResolutionBack = 'D'; newIntervalBack = 60; break
      case 'D': case '1D': newResolutionBack = 'M'; newIntervalBack = 5; break
    }

    return {
      resolutionBack: newResolutionBack,
      intervalBack: newIntervalBack
    }
  }


  private resolutionToCoinbaseProResolution (resolution: ResolutionString): ICoinbaseInterval {
    switch (resolution) {
      default: case '1': return '60'
      case '5': return '300'
      case '15': return '900'
      case '60': case '1h': return '3600'
      case '360': case '6h': return '21600'
      case 'D': case '1D': return '86400'
    }
  }
}
