// https://support.bitfinex.com/hc/en-us/articles/115003451049-Bitfinex-Order-Types
// http://www.online-stock-trading-guide.com/sell-stop-order.html
export type IOrderTypes = 'stop-loss' | 'take-profit' | 'stop-loss-take-profit' |
  'trailing-stop' | 'stop-limit' | 'future-order' | 'market' | 'limit' | 'take-limit' |
  'stop-market' | 'take-market' |
  'buy-stop' | 'sell-stop' | 'bracket-order' | 'scaled-order' | 'hidden' | 'post-only-limit' |
  'immediate-or-cancel' | 'reduce-only' | 'one-cancels-other' | 'fill-or-kill' | 'cancel-order'


export interface IOrderRequest {
  side: 'buy' | 'sell'
  kind: 'market' | 'limit' | 'stop-limit' | 'stop-market' | 'take-limit' | 'take-market' | 'trailing-stop' | 'advanced'
  market: 'spot' | 'margin' | 'paper'
  amount: number
  price?: number
  // symbol: string

  leverageMultiplier: number
}


export interface IAsset {
  symbol: string
  name: string
}


export interface IOrder {
  id?: any
  asset?: IAsset
  price: number
  amount?: number
}


export interface IOrderBook {
  bids: IOrder[]
  asks: IOrder[]
}
