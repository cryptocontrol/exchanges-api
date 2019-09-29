import * as qs from 'querystring'

import CCXTExchange from './core/CCXTExchange'
import { Bar, ResolutionString, HistoryDepth, ResolutionBackValues } from '../datafeed-api'

type IOkexInterval = '60' | '180' | '300' | '900' | '1800' | '3600'
  | '7200' | '14400' | '43200' | '86400' | '604800'


export default class OkEXExchange extends CCXTExchange {
  async getSupportedResolutions () {
    return ['1', '3', '5', '15', '30', '60', '120', '360', '720', 'D', 'W', '2W']
  }


  getHistory (ticker: string, resolution: string, rangeStartDate: number, rangeEndDate: number) {
    let granularity: IOkexInterval = '604800'

    switch (resolution) {
      default: case '1': granularity = '60'; break
      case '3': granularity = '180'; break
      case '5': granularity = '300'; break
      case '15': granularity = '900'; break
      case '30': granularity = '1800'; break
      case '60': granularity = '3600'; break
      case '120': granularity = '7200'; break
      case '360': granularity = '14400'; break
      case '720': granularity = '43200'; break
      case 'D': case '1D': granularity = '86400'; break
      case 'W': case '1W': granularity = '604800'; break
    }

    const symbol = this.exchange.marketId(ticker)
    const start: any = rangeStartDate * 1000
    const end: any = rangeEndDate * 1000

    const query = qs.stringify({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      granularity
    })

    return this.sendRequest<any[]>(`https://www.okex.com/api/spot/v3/instruments/${symbol}/candles?${query}`)
    .then(response  => {
      const bars: Bar[] = response.map(q => {
        return {
          time: Number(Date.parse(q[0])),
          open: Number(q[1]),
          high: Number(q[2]),
          low: Number(q[3]),
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



  calculateHistoryDepth (resolution: ResolutionString): HistoryDepth {
    let newResolutionBack: ResolutionBackValues, newIntervalBack: number

    // go back 1000 units in time
    switch (resolution) {
      default: break
      case '1': newResolutionBack = 'D'; newIntervalBack = 200 / 1440; break
      case '5': newResolutionBack = 'D'; newIntervalBack = 0.6; break
      case '15': newResolutionBack = 'D'; newIntervalBack = 2; break
      case '60': newResolutionBack = 'D'; newIntervalBack = 8; break
      case '360': newResolutionBack = 'D'; newIntervalBack = 40; break
      case 'D': case '1D': newResolutionBack = 'M'; newIntervalBack = 3; break
    }

    return {
      resolutionBack: newResolutionBack,
      intervalBack: newIntervalBack
    }
  }




  // public streamTrades(symbol: string): void {
  //   // check if we are already streaming this symbol or not
  //   // if (this.streamingTradesSymbol.indexOf(symbol) >= 0) return
  //   // this.streamingTradesSymbol.push(symbol)
  //   //
  //   const wsSymbol = this.exchange.marketId(symbol)

  //   this.clientws.on('open', () => {
  //     console.log('ws opened')
  //     this.clientws.send(`{ "method":"subscribeTrades","params": { "symbol": "${wsSymbol}" }, "id":123 }`)
  //   })

  //   this.clientws.on('message', (trade: any) => {
  //     const parsedJSON = JSON.parse(trade)
  //     const params = parsedJSON.params
  //     try {
  //       const data = params.data
  //       data.forEach(obj => {
  //         const price = obj.price
  //         const quantity = obj.quantity
  //         const timestamp = Date.parse(obj.timestamp)
  //         // console.log(price, quantity, timestamp)

  //         const ccxtTrade: ccxt.Trade = {
  //           amount: Number(quantity),
  //           datetime: (new Date(timestamp)).toISOString(),
  //           id: String(obj.id),
  //           price: Number(price),
  //           info: {},
  //           timestamp: timestamp,
  //           side: obj.side,
  //           symbol: undefined,
  //           takerOrMaker: trade.maker ? 'maker' : 'taker',
  //           cost: Number(price) * Number(quantity),
  //           fee: undefined
  //         }

  //         this.emit('trade', ccxtTrade)
  //       })
  //     } catch (e) {
  //       // test
  //     }
  //   })
  // }


  // public streamOrderbook (symbol: string) {
  //   const wsSymbol = symbol.replace('/', '').toUpperCase()

  //   this.clientws.on('open', () => {
  //     this.clientws.send(`{"method": "subscribeOrderbook","params": {  "symbol": "${wsSymbol}"},  "id": 123}`)
  //   })

  //   this.clientws.on('message', (orders: any) => {
  //     const parsedJSON = JSON.parse(orders)
  //     const params = parsedJSON.params
  //     try {
  //       const bids: IOrder[] = params.bid.map(bid => {
  //         return {
  //           asset: wsSymbol,
  //           price: bid.price,
  //           amount: bid.size
  //         }
  //       })

  //       const asks: IOrder[] = params.ask.map(ask => {
  //         return {
  //           asset: wsSymbol,
  //           price: ask.price,
  //           amount: ask.size
  //         }
  //       })

  //       const orderBook: IOrderBook = {
  //         bids: bids,
  //         asks: asks
  //       }
  //       this.emit('orderbook', orderBook)
  //       console.log(orderBook)
  //     } catch (e) {
  //       // test
  //     }
  //   })
  // }
}
