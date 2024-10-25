import { DurableObject } from "cloudflare:workers";

export default class SubscribeLabelsObject extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
  }

  async announceLabel() { }
}

// app.get('/xrpc/com.atproto.label.subscribeLabels', (c) => {
//   console.log({
//     route: '/xrpc/com.atproto.label.subscribeLabels',
//     queries: c.req.queries()
//   })
//   const upgradeHeader = c.req.header('Upgrade')
//   if (!upgradeHeader || upgradeHeader != 'websocket') {
//     c.status(426)
//     return c.text('Expected Upgrade: websocket')
//   }

//   const wsPair = new WebSocketPair();
//   const [client, server] = Object.values(wsPair);

//   server.accept();

//   // we can hide in here, but only for ~30 seconds...
//   c.executionCtx.waitUntil((async () => {
//     // while(true) {
//     //   await sleep(500)
//     //   try {
//     //     server.send("message")
//     //   } catch(e) {
//     //     console.log({e})
//     //     continue;
//     //   }
//     //   break;
//     // }
//     console.log("sent message")
//     await sleep(30_000)
//     console.log("closing connection")
//     server.close();
//   })())

//   return new Response(null, {
//     status: 101,
//     webSocket: client
//   })
// })

