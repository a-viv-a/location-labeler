import { Hono } from "hono";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const app = new Hono();

app.get('/', (c) => c.text("hiiiiii"))
app.get('/route', (c) => c.text("hello?"))

export default app;
