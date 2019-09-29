import * as qs from 'querystring'
import * as ccxt from 'ccxt'

import Websocket from '../Websocket'
import CCXTExchange from './core/CCXTExchange'
import { Bar } from '../datafeed-api'

type IHitBTCInterval = 'M1' | 'M3' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'D7' | '1M'



export default class HitbtcExchange extends CCXTExchange {
  private readonly clientws: Websocket
  private readonly streamingTradesSymbol: string[]

  constructor (exchange: ccxt.Exchange) {
    super(exchange)

    const client = new Websocket('wss://api.hitbtc.com/api/2/ws')
    this.clientws = client
    this.streamingTradesSymbol = []
  }


  getSupportedResolutions(): string[] {
    return ['1', '3', '5', '15', '30', '60', '240', 'D', 'W', 'M']
  }


  getHistory (ticker: string, resolution: string, rangeStartDate: number, rangeEndDate: number) {
    let period: IHitBTCInterval
    switch (resolution) {
      default: case '1': period = 'M1'; break
      case '3': period = 'M3'; break
      case '5': period = 'M5'; break
      case '15': period = 'M15'; break
      case '30': period = 'M30'; break
      case '60': period = 'H1'; break
      case '240': period = 'H4'; break
      case 'D': case '1D': period = 'D1'; break
      case 'W': case '1W': period = 'D7'; break
      case 'M': case '1M': period = '1M'; break
    }

    const symbol = this.exchange.marketId(ticker)

    const query = qs.stringify({
      period,
      from: rangeStartDate * 1000,
      till: rangeEndDate * 1000,
      limit: 1000
    })

    return this.sendRequest<any[]>(`https://api.hitbtc.com/api/2/public/candles/${symbol}?${query}`)
    .then(response => {
      const bars: Bar[] = response.map(r => {
        return {
          time: (new Date(r.timestamp)).getTime(),
          open: Number(r.open),
          high: Number(r.max),
          low: Number(r.min),
          close: Number(r.close),
          volume: Number(r.volume),
        }
      })

      return { bars, meta: { noData: response.length === 0 } }
    })
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
