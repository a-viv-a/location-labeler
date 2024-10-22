import { Hono } from "hono";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		return new Response('Hello World!');
// 	},
// } satisfies ExportedHandler<Env>;

const app = new Hono();

app.get('/', (c) => c.text("hiiiiii"))
app.get('/route', (c) => c.text("hello?"))

export default app;
