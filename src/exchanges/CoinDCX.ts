import * as ccxt from 'ccxt'
const request = require('request-promise')
const crypto = require('crypto')

import CCXTExchange from './core/CCXTExchange'


const resolution = ['1', '5', '15', '30', '60', '240', '480', 'D']

const secret = '...'

const _api = async (path: string, method: string = 'GET', data: any = {}, signature): Promise<any> => {
  const options = {
    method,
    url: `https://api.coindcx.com${path}`,
    headers: {
      'X-AUTH-APIKEY': '...',
      'X-AUTH-SIGNATURE': signature
    },
    json: true,
    body: data
  }

  return await request(options)
}

export default class CoindcxExchange extends CCXTExchange {
  private readonly socket: WebSocket

  private readonly channelIdToSymbol: {
    [channelId: number]: string
  }

  private readonly streamingTradesChannelIds: {
    [symbol: string]: number
  }

  private readonly streamingOrderbookSymbolChannelIds: {
    [symbol: string]: number
  }


  constructor (exchange: ccxt.Exchange) {
    super(exchange)
    //
    // this.streamingTradesChannelIds = {}
    // this.streamingOrderbookSymbolChannelIds = {}
    //
    // const url = `wss://stream.coindcx.com`
    // this.socket = new WebSocket(url)

  }


  public async fetchTickers(symbol: string) {
    // sdf
  }


  public async loadMarkets() {
    const markets = await request.get('https://api.coindcx.com/exchange/v1/markets', (err, res, body) => {
      return body
    })
    console.log(markets)
    return markets
  }


  public async getCandles (symbol: string) {
    // got to put the from and to of the candles
    const currentDate = (new Date().getTime() / 1000)
    // console.log(currentDate)

    const candles = await request
      .get(
        `https://api.coindcx.com/api/v1/chart/history_v2?symbol=${symbol}&resolution=1&from=1564309317&to=1564395777`,
        (err, res, body) => body
      )
    console.log(candles)
    return candles
  }


  public async createOrder (side: string, kind: string, symbol: string, price: number, amount: number) {
    const currentDate = (new Date().getTime() / 1000)

    const data = {
      'side': side,  // Toggle between 'buy' or 'sell'.
      'order_type': kind, // Toggle between a 'market_order' or 'limit_order'.
      'market': symbol, // Replace 'SNTBTC' with your desired market.
      'price_per_unit': price, // This parameter is only required for a 'limit_order'
      'total_quantity': amount, // Replace this with the quantity you want
      'timestamp': currentDate
    }
    const payload = new Buffer(JSON.stringify(data)).toString()
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const order = await _api(`/exchange/v1/orders/create`, 'POST', data, signature)
    return order
  }


  public async openOrders (side: string, symbol: string) {
    const currentDate = (new Date().getTime() / 1000)
    const data = {
      'side': side, // Toggle between 'buy' or 'sell'.
      'market': symbol, // Replace 'SNTBTC' with your desired market pair.
      'timestamp': currentDate
    }
    const payload = new Buffer(JSON.stringify(data)).toString()
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const openOrders = await _api(`/exchange/v1/orders/active_orders`, 'POST', data, signature)
    return openOrders
  }


  public async cancelOrder (id: string) {
    const currentDate = (new Date().getTime() / 1000)
    const data = {
      'id': id, // Replace this with your Order ID.
      'timestamp': currentDate
    }
    const payload = new Buffer(JSON.stringify(data)).toString()
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const cancelOrder = await _api(`/exchange/v1/orders/cancel`, 'POST', data, signature)
    return cancelOrder
  }


  public async orderStatus (id: string) {
    const timestamp = (new Date().getTime() / 1000)
    const data = {
      'id': id, // Replace this with your Order ID.
      'timestamp': timestamp
    }
    const payload = new Buffer(JSON.stringify(data)).toString()
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const status = await _api(`/exchange/v1/orders/status`, 'POST', data, signature)
    return status
  }


  public async tradeHistory() {
    var timeStamp = Math.floor(Date.now())
    const data = {
      'limit': 50
    }

    const payload = new Buffer(JSON.stringify(data)).toString()
    const signature = crypto.createHmac('sha256', '...').update(payload).digest('hex')
    // console.log(signature)
    const tradeHistory = await _api(`/exchange/v1/orders/trade_history`, 'POST', data, signature)
    // console.log(tradeHistory)
    return tradeHistory
  }
}


// const run = new CoindcxExchange('..')
// // run.loadMarkets()
// // run.getCandles('ETHTUSD')
// run.tradeHistory()
