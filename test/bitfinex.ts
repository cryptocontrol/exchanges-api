const ws = require('ws')
const w = new ws('wss://api-pub.bitfinex.com/ws/2')

let msg = JSON.stringify({
  event: 'subscribe',
  channel: 'trades',
  symbol: 'tBTCUSD'
})

let test = []

w.on('open', () => {
  console.log('open')
  w.send(msg)
})

let chanId

//
// setTimeout(() => {
//   w.close()
// }, 30 * 1000)


w.on('message', (msg) => {
  const response = JSON.parse(msg)

  if (response.event === 'subscribed') chanId = response.chanId

  try{
    let channelId = response[0]
    let data = response[2]
    let ID = data[0]
    let mts = data[1]
    let amount = data[2]
    let price = data[3]
    console.log(response, test.length)

    if(price != undefined)
    test.push(price)

    let unsubscribe = JSON.stringify({
      event: 'unsubscribe',
      chanId: chanId
    })


    //condition to unsubscribe
    if(test.length == 5){
      // don't close the connection; just send the un-subscribe....; keep the
      // connection open throughout the app's session
      console.log('closing')
      w.send(unsubscribe)
      console.log('connection closed')
    }
  } catch (e) { console.log(e) }
})
