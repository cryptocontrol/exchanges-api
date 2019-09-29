import * as ccxt from 'ccxt'
import { isArray } from 'util'
import * as qs from 'querystring'

import { Bar, GetBarsResult } from  '../datafeed-api'
import CCXTExchange from './core/CCXTExchange'


interface ISocketTradeMessage {
  e: string
  E: number
  s: string
  t: number
  p: string
  q: string
  b: number
  a: number
  T: number
  m: boolean
  M: boolean
}



interface ISocketDiffDepthMessage {
  a: [string, string][]
  b: [string, string][]
  E: number
  e: string
  s: string
  U: number
  u: number
}


type IBitfinexInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '3h'
  | '6h' | '12h' | '1D' | '7D' | '14D' | '1M'


type ICCXTSymbol = string
type IBFXSymbol = string

export default class BitfinexExchange extends CCXTExchange {
  private readonly socket: WebSocket
  private isSocketOpened: boolean = false

  private readonly channelIdToBFXSymbol: {
    [channelId: number]: IBFXSymbol
  } = {}

  private readonly streamingTradesChannelIds: {
    [bfxSymbol in IBFXSymbol]: number
  } = {}

  private readonly streamingOrderbookSymbolChannelIds: {
    [bfxSymbol in IBFXSymbol]: number
  } = {}


  private readonly supportedWebsocketSymbols = [
    'BTCUSD', 'LTCUSD', 'LTCBTC', 'ETHUSD', 'ETHBTC', 'ETCBTC', 'ETCUSD', 'RRTUSD', 'RRTBTC', 'ZECUSD', 'ZECBTC',
    'XMRUSD', 'XMRBTC', 'DSHUSD', 'DSHBTC', 'BTCEUR', 'XRPUSD', 'XRPBTC', 'IOTUSD', 'IOTBTC', 'IOTETH', 'EOSUSD',
    'EOSBTC', 'EOSETH', 'SANUSD', 'SANBTC', 'SANETH', 'OMGUSD', 'OMGBTC', 'OMGETH', 'BCHUSD', 'BCHBTC', 'BCHETH',
    'NEOUSD', 'NEOBTC', 'NEOETH', 'ETPUSD', 'ETPBTC', 'ETPETH', 'QTMUSD', 'QTMBTC', 'QTMETH', 'AVTUSD', 'AVTBTC',
    'AVTETH', 'EDOUSD', 'EDOBTC', 'EDOETH', 'BTGUSD', 'BTGBTC', 'DATUSD', 'DATBTC', 'DATETH', 'QSHUSD', 'QSHBTC',
    'QSHETH', 'YYWUSD', 'YYWBTC', 'YYWETH', 'GNTUSD', 'GNTBTC', 'GNTETH', 'SNTUSD', 'SNTBTC', 'SNTETH', 'IOTEUR',
    'BATUSD', 'BATBTC', 'BATETH', 'MNAUSD', 'MNABTC', 'MNAETH', 'FUNUSD', 'FUNBTC', 'FUNETH', 'ZRXUSD', 'ZRXBTC',
    'ZRXETH', 'TNBUSD', 'TNBBTC', 'TNBETH', 'SPKUSD', 'SPKBTC', 'SPKETH', 'TRXUSD', 'TRXBTC', 'TRXETH', 'RCNUSD',
    'RCNBTC', 'RCNETH', 'RLCUSD', 'RLCBTC', 'RLCETH', 'AIDUSD', 'AIDBTC', 'AIDETH', 'SNGUSD', 'SNGBTC', 'SNGETH',
    'REPUSD', 'REPBTC', 'REPETH', 'ELFUSD', 'ELFBTC', 'ELFETH'
  ]

  private readonly supportedMarginSymbols = [
    'BTCUSD', 'LTCUSD', 'LTCBTC', 'ETHUSD', 'ETHBTC', 'ETCBTC', 'ETCUSD', 'ZECUSD', 'ZECBTC', 'XMRUSD', 'XMRBTC',
    'DSHBTC', 'BTCEUR', 'BTCJPY', 'XRPUSD', 'XRPBTC', 'IOTUSD', 'IOTBTC', 'IOTETH', 'EOSUSD', 'EOSBTC', 'EOSETH',
    'SANBTC', 'SANETH', 'OMGUSD', 'OMGBTC', 'OMGETH', 'NEOUSD', 'NEOBTC', 'NEOETH', 'ETPUSD', 'ETPBTC', 'ETPETH',
    'EDOBTC', 'EDOETH', 'BTGUSD', 'BTGBTC', 'IOTEUR', 'ZRXUSD', 'ZRXETH', 'BTCGBP', 'ETHEUR', 'ETHJPY', 'ETHGBP',
    'NEOJPY', 'NEOGBP', 'EOSEUR', 'EOSJPY', 'EOSGBP', 'IOTJPY', 'IOTGBP', 'XLMUSD', 'XLMBTC', 'XTZUSD', 'XTZBTC',
    'BSVBTC', 'BABUSD', 'BABBTC', 'USTUSD', 'BTCUST', 'ETHUST', 'LEOUSD', 'LEOUST', 'BTCF0:USTF0', 'ETHF0:USTF0',
    'DSHUSD', 'BSVUSD', 'NEOEUR', 'EDOUSD', 'SANUSD',
  ]


  constructor (exchange: ccxt.Exchange) {
    super(exchange)

    const url = `wss://api-pub.bitfinex.com/ws/2`
    this.socket = new WebSocket(url)

    this.socket.onmessage = this.onWebsocketMessage
    this.socket.onclose = _event => { this.isSocketOpened = true }
  }


  allowsMarginTrading (symbol: string) {
    // todo: use the values from https://api.bitfinex.com/v1/symbols_details
    const bfxSymbol = this.exchange.marketId(symbol)
    return this.supportedMarginSymbols.indexOf(bfxSymbol) >= 0
  }


  getSupportedResolutions(): string[] {
    return ['1', '5', '15', '30', '60', '180', '360', '720', 'D', 'W', '2W', 'M']
  }


  getHistory (ticker: string, resolution: string, rangeStartDate: number, rangeEndDate: number):
    Promise<GetBarsResult> {
    let interval: IBitfinexInterval = '15m'

    switch (resolution) {
      default: case '1': interval = '1m'; break
      case '5': interval = '5m'; break
      case '15': interval = '15m'; break
      case '30': interval = '30m'; break
      case '60': interval = '1h'; break
      case '180': interval = '3h'; break
      case '360': interval = '6h'; break
      case '720': interval = '12h'; break
      case 'D': case '1D': interval = '1D'; break
      case 'W': case '1W': interval = '7D'; break
      case '2W': interval = '14D'; break
      case 'M': case '1M': interval = '1M'; break
    }

    const symbol = ticker.replace('/', '')

    const start = rangeStartDate * 1000
    const end = rangeEndDate * 1000

    const options = { sort: 1, start, end, limit: 1000 }
    const url = `https://api.bitfinex.com/v2/candles/trade:${interval}:t${symbol}/hist?${qs.stringify(options)}`
    return this.sendRequest<string[]>(url)
    .then(response => {
      const bars: Bar[] = response.map(r => {
        return {
          time: Number(r[0]),
          open: Number(r[1]),
          close: Number(r[2]),
          high: Number(r[3]),
          low: Number(r[4]),
          volume: Number(r[5]),
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


  public async streamTrades (symbol: ICCXTSymbol) {
    if (!symbol) return
    const wsSymbol = this.exchange.marketId(symbol)
    if (!this.hasWebsocketSupport(wsSymbol)) return super.streamTrades(symbol)

    // check if we are already streaming this symbol or not
    if (this.streamingTradesChannelIds[wsSymbol]) return

    // first download all the recent trades
    super.getTrades(symbol)
    .then(trades => this.emit(`trade:full:${symbol}`, trades))

    // then start streaming from websockets
    this.send({ event: 'subscribe', channel: 'trades', symbol: `t${wsSymbol}` })
  }


  public async stopStreamingTrades (symbol: ICCXTSymbol) {
    const wsSymbol = this.exchange.marketId(symbol)
    if (!this.hasWebsocketSupport(wsSymbol)) return super.stopStreamingTrades(symbol)
    if (!this.streamingTradesChannelIds[wsSymbol]) return

    await this.send({
      event: 'unsubscribe',
      chanId: this.streamingTradesChannelIds[wsSymbol]
    })

    delete this.streamingTradesChannelIds[wsSymbol]
  }


  // public streamOrderbook(symbol: string): void {
  //   if (!symbol) return
  //
  //   // check if we are already streaming this symbol or not
  //   if (this.streamingOrderbookSymbol[symbol]) return
  //
  //   // first emit a full orderbook
  //   super.getOrderbook(symbol)
  //   .then(orderbook => this.emit(`orderbook:full:${symbol}`, orderbook))
  //
  //   // then start streaming the changes using websockets
  //   const wsSymbol = symbol.replace('/', '').toLowerCase()
  //   const url = `wss://stream.binance.com:9443/ws/${wsSymbol}@depth`
  //   const socket = new WebSocket(url)
  //
  //   socket.onmessage = (event: any) => {
  //     try {
  //       const data: ISocketDiffDepthMessage = JSON.parse(event.data)
  //
  //       const bids: IOrder[] = data.b.map(bid => {
  //         return { price: Number(bid[0]), amount: Number(bid[1]) }
  //       })
  //
  //       const asks: IOrder[] = data.a.map(ask => {
  //         return { price: Number(ask[0]), amount: Number(ask[1]) }
  //       })
  //
  //       this.emit(`orderbook:${symbol}`, { bids, asks })
  //     } catch (e) {
  //       // do nothing
  //     }
  //   }
  //
  //   socket.onclose = _event => { delete this.streamingOrderbookSymbol[symbol] }
  //
  //   this.streamingOrderbookSymbol[symbol] = socket
  // }


  private onWebsocketMessage = async (event: any) => {
    this.isSocketOpened = true

    try {
      const data = JSON.parse(event.data)

      // capture the channel id
      if (data.event === 'subscribed' && data.channel === 'trades') {
        this.streamingTradesChannelIds[data.pair] = data.chanId
        this.channelIdToBFXSymbol[data.chanId] = data.pair
        return
      }

      if (!isArray(data)) return

      const [chanId, abbrv, tradeData] = data
      const bfxSymbol = this.channelIdToBFXSymbol[chanId]
      const ccxtSymbol = this.exchange.symbol(bfxSymbol)

      // if this is not a trade update; we bail
      // abbrevations over here: https://docs.bitfinex.com/v2/docs/abbreviations-glossary
      if (abbrv !== 'tu') return

      const [tradeId, timestamp, amount, price] = tradeData
      // parse the trade over here...

      const ccxtTrade: ccxt.Trade = {
        amount: Math.abs(amount),
        cost: Math.abs(amount) * Number(price),
        datetime: (new Date(timestamp)).toISOString(),
        fee: undefined,
        id: String(tradeId),
        info: {},
        price: Number(price),
        side: amount < 0 ? 'sell' : 'buy',
        symbol: bfxSymbol,
        takerOrMaker: undefined, // data.m ? 'maker' : 'taker',
        timestamp
      }

      this.emitThrottled(`trade:${ccxtSymbol}`, [ccxtTrade])
    } catch (e) {
      // do nothing
    }
  }


  private async send (data: any) {
    // serialize to json
    const msg = JSON.stringify(data)

    // wait for the connection to be opened
    await this.awaitForConnection()

    // send bitches!
    this.socket.send(msg)
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


  private hasWebsocketSupport (bfxSymbol: IBFXSymbol) {
    return this.supportedWebsocketSymbols.indexOf(bfxSymbol) >= 0
  }
}
