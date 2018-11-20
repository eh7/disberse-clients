'use strict'

const domReady = require('detect-dom-ready')
const createNode = require('./create-node')
const messageFormat = require('./messageFormat')

const pull = require('pull-stream')
const PeerInfo = require('peer-info')
const PeerId   = require('peer-id')
//const TextDecoder = require('TextDecoder')

const store = require('store')
const bip39 = require('bip39')
const hdkey = require('ethereumjs-wallet/hdkey')

//IE support
if (!Array.prototype.indexOf) { 
    Array.prototype.indexOf = function(obj, start) {
         for (var i = (start || 0), j = this.length; i < j; i++) {
             if (this[i] === obj) { return i; }
         }
         return -1;
    }
}

let peerMap = []

let phrase

if(!store.get('user')){
  phrase = bip39.generateMnemonic()
  store.set('user', {'bip39':phrase})
} else {
  phrase = store.get('user').bip39;
}
/*
if(phrase === ''){
  phrase = bip39.generateMnemonic()
  store.set('user', {'bip39':phrase})
}
*/
let myHdWallet = hdkey.fromMasterSeed(phrase)
store.set('address', "0x"+myHdWallet.getWallet().getAddress().toString('hex'))
//alert(store.get('address'))
//alert(myHdWallet.getWallet().getAddress().toString('hex'))

domReady(() => {
  const myPeerDiv = document.getElementById('my-peer')
  const swarmDiv = document.getElementById('swarm')

  const messagesDiv = document.getElementById('messages')
  const messageRepondentSelect = document.getElementById('messageRepondentSelect')
  const messageTextInput = document.getElementById('messageText')

  createNode(myHdWallet.getWallet().getAddress().toString('hex'), (err, node) => {
    if (err) {
      return console.log('Could not create the Node, check if your browser has WebRTC Support', err)
    }

    let connections = {}
    let connected   = {}
    let nodes = []
    let liveConnections = []
    let messageCount = 0

    node.on('peer:discovery', (peerInfo) => {

//      node.dial(peerInfo, () => {})

      const idStr = peerInfo.id.toB58String()

      if(connections[idStr]) {
        console.log("connected already")
        return
      }

      console.log('Discovered a peer')
      console.log('Discovered: ' + idStr)

      connections[idStr] = true
      nodes.push(peerInfo)
     
//console.log(connections)
//console.log(nodes)

      node.dial(peerInfo, (err, conn) => {
        let timeToNextDial = 0
        if (err) {
          // Prevent immediate connection retries from happening
          timeToNextDial = 60 * 1000
          console.log('Failed to dial:', idStr)
        } 

        node.dialProtocol(peerInfo, '/register', (err, conn) => {
          let message =  node.peerInfo.id.toB58String() + "::" + store.get('address') 
          pull(
            pull.values([message]),
            conn
          )
          console.log("sent '" + message + "' to " + peerInfo.id.toB58String())

          node.dialProtocol(peerInfo, '/peerMap', (err, conn) => {
            console.log("Dialing for latest peerMap")
            peerMap = []
            pull(
              conn,
              pull.map((data) => {
                peerMap.push(data.toString())
//                console.log(data.toString())
                console.log("Dialing for latest peerMap Done\n" + peerMap +"\n")
              }),
              pull.drain(()=>{})
            )
            console.log("Dialing for latest peerMap Done\n" + peerMap +"\n")
          })
        })

        setTimeout(() => delete connections[idStr], timeToNextDial)
//        setTimeout(() => {}, timeToNextDial)
      })
    })

    node.on('peer:connect', (peerInfo) => {

      const idStr = peerInfo.id.toB58String()

      if(!connected[idStr]) {

        connected[idStr] = true

        console.log('Got connection to: ' + idStr)
//        connections[idStr] = true
        const connDiv = document.createElement('div')
        connDiv.innerHTML = 'Connected to: ' + idStr
        connDiv.id = idStr
        swarmDiv.append(connDiv)

        const connItem = document.createElement('option')
        connItem.innerHTML = idStr
        connItem.id = 'connItem-' + idStr
        messageRepondentSelect.append(connItem)
        console.log("added option")
      }

    })

    node.on('peer:disconnect', (peerInfo) => {
      const idStr = peerInfo.id.toB58String()
      console.log('Lost connection to: ' + idStr)
      document.getElementById(idStr).remove()
    })

    node.start((err) => {
      if (err) {
        return console.log('WebRTC not supported')
      }

      // reset pharse run
      // store.set('user', {'bip39':''})

/*
      let phrase = store.get('user').bip39;
      if(phrase === ''){
        phrase = bip39.generateMnemonic()
        store.set('user', {'bip39':phrase})
      }
      let myHdWallet = hdkey.fromMasterSeed(phrase)
      
      // alert(JSON.stringify(hdkey.fromMasterSeed(phrase)))
//      alert(phrase +"\n" + myHdWallet)
//      alert(JSON.stringify(myHdWallet.getWallet()))
      alert(myHdWallet.getWallet().getAddress().toString('hex'))
*/
/*
      let derivedHDWallet = myHdWallet.derivePath("m/44'/0'/0/1")
      alert(
        derivedHDWallet.getWallet().getAddress().toString('hex') + "\n" +
        derivedHDWallet.getWallet().getPublicKey().toString('hex') + "\n" +
        derivedHDWallet.getWallet().getPrivateKey().toString('hex')
      )
      derivedHDWallet = myHdWallet.derivePath("m/44'/0'/0/2")
      alert(derivedHDWallet.getWallet().getAddress().toString('hex'))
      derivedHDWallet = myHdWallet.derivePath("m/44'/0'/0/3")
      alert(derivedHDWallet.getWallet().getAddress().toString('hex'))
*/

//      alert("0x" + store.get('user').address)

      const idStr = node.peerInfo.id.toB58String()
 
//      const welcomMessage = 'Node is ready. ID: ' + idStr + 'Address:' + store.get('address')

      const idDiv = document
        .createTextNode('Node is ready. ID: ' + idStr + '\naddress: ' + store.get('address'))
      myPeerDiv.append(idDiv)

//      const addressDiv = document
//        .createElement('SPAN')
//      addressDiv.innerHTML = '<br>Address:' + store.get('address'))
//      myPeerDiv.append(addressDiv)

      console.log('Node is listening o/')

      // NOTE: to stop the node
      // node.stop((err) => {})
    })

    node.handle('/disberse/peer/0.0.0', (protocol, conn) => {
      pull(
        conn,
        pull.map((v) => v.toString()),
        pull.log()
      )
    })

    node.handle('/peerMap', (protocol, conn) => {
      console.log("/peerMap recieve latest peerMap from caller")
    })

    node.handle('/message', (protocol, conn) => {

      pull(
        conn,
        pull.map((data) => {
          var string = new TextDecoder("utf-8").decode(data)
          conn.getPeerInfo((err, peerInfo) => {

            const idStr = peerInfo.id.toB58String()

            messageFormat(messagesDiv, "in-" + idStr, string)

            messageCount++
            console.log("handle message in")
          })
          console.log(string)
        }),
        pull.drain(()=>{})
      )
    })


    // ("add messageTextInput events handle here")
    function handleMessageInputEvent (type, event) {
//      if(event.keyCode === 13) {
//        console.log('messageTextInput keyup: ' + messageTextInput.value)
//        console.log('messageTextInput event.keyCode: ' + event.keyCode)
//      } else
//        console.log(type + ': ' + messageTextInput.value)

      if(!messageTextInput.value) return

      let message = messageTextInput.value

      console.log("messageRepondentSelect.value: " + messageRepondentSelect.value)
//      let id = messageRepondentSelect.value
//      console.log(id)
      let sendToPeerId = PeerId.createFromB58String(messageRepondentSelect.value)
      console.log("id: " + sendToPeerId)
      PeerInfo.create(sendToPeerId, (err, sendToPeerInfo) => {
        if(err) console.log(err)
        console.log("info: " + sendToPeerInfo)

        const idStr = node.peerInfo.id.toB58String()

        messageFormat(messagesDiv, "out-" + idStr, message)

        messageCount++

        node.dialProtocol(sendToPeerInfo, '/message', (err, conn) => {
          pull(
            pull.values([message]),
            conn
          )
          console.log("sent text to " + sendToPeerInfo.id.toB58String())
        })
      })
/*
*/

      console.log("send message out \"" + messageTextInput.value + "\"")
//      console.log(liveConnections)
//console.log(connections)
//console.log(nodes)
/*
      console.log(node.peerBook)
      node.peerBook
        .getAllArray()
        .forEach((peer) => {
          console.log('This node connected to node:', peer.isConnected().toString())

          node.dialProtocol(nodes[0], '/message', (err, conn) => {
            pull(
              pull.values([messageTextInput.value]),
              conn
            )
            console.log("sent text to " + peerInfo.id.toB58String())
          })

        })
*/

      messageTextInput.value = '';
    }
    messageTextInput.onclick = (event) => { 
      handleMessageInputEvent('messageTextInput clicked', event)
    }
    messageTextInput.onblur = (event) => { 
      handleMessageInputEvent('messageTextInput blured', event)
    }
    messageTextInput.onkeyup = (event) => { 
      if(event.keyCode === 13) {
        handleMessageInputEvent('messageTextInput blured', event)
      }
    }

  })
})
