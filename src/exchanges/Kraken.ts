import * as qs from 'querystring'

import CCXTExchange from './core/CCXTExchange'
import { Bar } from '../datafeed-api'


type IKrakenInterval = '1' | '5' | '15' | '30' | '60' | '240'
  | '1440' | '10080' | '21600'



export default class KrakenExchange extends CCXTExchange {
  getSupportedResolutions(): string[] {
    return ['1', '5', '15', '30', '60', 'D', 'W', '2W']
  }


  getHistory (ticker: string, resolution: string, rangeStartDate: number, rangeEndDate: number) {
    let interval: IKrakenInterval = '15'

    // use websockets
    // visit https://dwq4do82y8xi7.cloudfront.net/widgetembed/?symbol=KRAKEN%3AXBTEUR&interval=D&symboledit=1&
    // toolbarbg=f1f3f6&hideideas=1&studies=&theme=White&style=1&timezone=exchange

    switch (resolution) {
      default: case '1': interval = '1'; break
      case '5': interval = '5'; break
      case '15': interval = '15'; break
      case '30': interval = '30'; break
      case '60': interval = '60'; break
      case 'D': case '1D': interval = '1440'; break
      case 'W': case '1W': interval = '10080'; break
      case '2W': case '15D': interval = '21600'; break
    }

    const symbol = this.exchange.marketId(ticker)

    const start = rangeStartDate * 1000
    const end = rangeEndDate * 1000

    const options = { pair: symbol, interval: interval }

    const url = `https://api.kraken.com/0/public/OHLC?${qs.stringify(options)}`
    return this.sendRequest<any>(url)
    .then(response  => {
      const result = response.result[symbol]

      const bars: Bar[] = result.map(q => {
        return {
          time: Number(q[0] * 1000),
          open: Number(q[1]),
          high: Number(q[2]),
          low: Number(q[3]),
          close: Number(q[4]),
          volume: Number(q[6]),
        }
      })
      // .reverse()
      // .filter(b => b.time > start && b.time < end)

      return {
        bars,
        meta: {
          noData: true // response.length === 0
        }
      }
    })
  }
}
