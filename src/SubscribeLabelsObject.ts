import { DurableObject } from "cloudflare:workers";
import { IndexedLabel } from "./types";
import { frameToBytes } from "./util";
import { formatLabel } from "@skyware/labeler";
import { sendLabels } from "./atproto";

// export abstract class DurableObject<Env = unknown>
//   implements Rpc.DurableObjectBranded
// {
//   [Rpc.__DURABLE_OBJECT_BRAND]: never;
//   protected ctx: DurableObjectState;
//   protected env: Env;
//   constructor(ctx: DurableObjectState, env: Env);
//   fetch?(request: Request): Response | Promise<Response>;
//   alarm?(): void | Promise<void>;
//   webSocketMessage?(
//     ws: WebSocket,
//     message: string | ArrayBuffer,
//   ): void | Promise<void>;
//   webSocketClose?(
//     ws: WebSocket,
//     code: number,
//     reason: string,
//     wasClean: boolean,
//   ): void | Promise<void>;
//   webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
// }

export default class SubscribeLabelsObject extends DurableObject<Env> {
  private readonly storage: DurableObjectStorage
  private readonly newSubscriptions: Array<{
    ws: WebSocket,
    cursor: number
  }> = []
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.storage = ctx.storage;
  }


  async fetch(request: Request) {
    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.
    // Unlike `ws.accept()`, `state.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
    // is "hibernatable", so the runtime does not need to pin this Durable Object to memory while
    // the connection is open. During periods of inactivity, the Durable Object can be evicted
    // from memory, but the WebSocket connection will remain open. If at some later point the
    // WebSocket receives a message, the runtime will recreate the Durable Object
    // (run the `constructor`) and deliver the message to the appropriate handler.
    this.ctx.acceptWebSocket(server);

    const cursor = parseInt(new URLSearchParams(request.url).get('cursor') ?? '0')

    // respond to this request in a second
    this.newSubscriptions.push({
      ws: server,
      cursor
    })
    this.storage.setAlarm(1_000)

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async alarm() {
    let newSubscription: {ws: WebSocket, cursor: number} | undefined
    while((newSubscription = this.newSubscriptions.pop()) != undefined) {
      const { ws, cursor } = newSubscription
      console.log({ msg: "processing new subscription", cursor })
      sendLabels(cursor, this.env, (l) => this.announceLabelForWs(ws, l), (e, m) => this.announceError(ws, e, m))
    }
  }

  // async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
  //   // Upon receiving a message from the client, reply with the same message,
  //   // but will prefix the message with "[Durable Object]: " and return the
  //   // total number of connections.
  //   ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`);
  // }

  // async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
  //   // If the client closes the connection, the runtime will invoke the webSocketClose() handler.
  //   ws.close(code, "Durable Object is closing WebSocket");
  // }

  private announceError(ws: WebSocket, error: string, message: string) {
    console.error({ error, message })
    const errorBytes = frameToBytes("error", {
      error,
      message,
    });
    ws.send(errorBytes);
    ws.close();
  }

  private announceLabelForWs(ws: WebSocket, { id, ...label}: IndexedLabel) {
    const bytes = frameToBytes(
      "message",
      // try and ensure at the boundery that label sig is correctly typed
      { seq: id, labels: [formatLabel({...label, sig: new Uint8Array(label.sig)})] },
      "#labels",
    );
    ws.send(bytes);
  }

  async announceLabels(labels: IndexedLabel[]) {
    console.log("announcing", labels)
    for (const ws of this.ctx.getWebSockets()) {
      for (const label of labels) {
        this.announceLabelForWs(ws, label)
      }
    }
  }

}

