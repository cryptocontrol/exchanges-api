// const ws = require('ws')
//
//
// const socketEndpoint = "wss://stream.coindcx.com"//
// const socket = new ws(socketEndpoint)//
//
// //Join Channel
// // socket.emit('join', {
// //   'channelName': "B-XRP_ETH",
// // })//
// socket.on('open', () => {
//    socket.emit('join', {
//     'channelName': "B-SNM_BTC",
//   })
// })
//
// //Listen update on channelName
// socket.on('new-trade', (response) => {
//   console.log('e',response.data)// })//
// // leave a channel
// // socket.emit('leave', {
// //   'channelName': channelName
// // })
