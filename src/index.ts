import { Hono } from "hono";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const app = new Hono();

app.get('/', (c) => c.text("hiiiiii"))
app.post('/request-label', async (c) => {
  const token = c.req.header('Token')

  if (token == undefined || token.length == 0) {
    c.status(401)
    return c.json({ msg: "missing Token header" })
  }

  const latitude = c.req.query('lat')
  const longitude = c.req.query('long')
  if (latitude == undefined || longitude == undefined) {
    c.status(400)
    return c.json({ msg: "invalid / missing lat and long query params" })
  }

  c.status(200)
  return c.json({ location: "place" })
})

export default app;
