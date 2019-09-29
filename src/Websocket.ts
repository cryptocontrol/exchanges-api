export default class Websocket {
  private number = 0	// Message number
  private autoReconnectInterval = 5 * 1000	// ms
  private instance: WebSocket
  private url: string

  constructor (url: string) {
    this.url = url
  }

  open = () => {
    this.instance = new WebSocket(this.url)

    this.instance.onopen = this.onOpen

    this.instance.onmessage = (event) => {
      this.number++
      this.onMessage(event.data)
    }

    this.instance.onclose = e => {
      switch (e.code) {
        case 1000: break // CLOSE_NORMAL
        default: this.reconnect(); break // Abnormal closure
      }

      this.onClose(e)
    }

    this.instance.onerror = e => {
      console.log(e)
      // switch (e.code) {
      //   case 'ECONNREFUSED': this.reconnect(); break
      //   default: this.onError(e); break
      // }
    }
  }


  send (data: any) {
    try {
      this.instance.send(data)
    } catch (e) {
      this.instance.onerror(e)
      // this.instance.emit('error', e)
    }
  }


  close () {
    if (this.instance) this.instance.close()
  }


  reconnect () {
    // console.log(`WebSocketClient: retry in ${this.autoReconnectInterval}ms`)
    // this.instance.removeAllListeners()
    setTimeout(this.open, this.autoReconnectInterval)
  }


  onOpen () {
    // console.log('WebSocketClient: open', arguments)
  }


  onMessage (data: any) {
    // console.log('WebSocketClient: message',arguments)
  }


  onError (e: Event) {
    // console.log('WebSocketClient: error', arguments)
  }


  onClose (e: Event) {
    // console.log('WebSocketClient: closed', arguments)
  }
}
