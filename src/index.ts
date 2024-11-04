import { Hono } from "hono";
import {
  point,
  distance
} from "@turf/turf";
import { prepareLabel, ensureLabelExists, signAndRecordLabelNegatingPrevious } from "./atproto";
import { build_label_definition as buildLabelDefinition } from "./label";
import { Place } from "./types";
import SubscribeLabelsObject from "./SubscribeLabelsObject";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { IdResolver } from '@atproto/identity'
import { verifyJwt } from "@atproto/xrpc-server";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const app = new Hono<{
  Bindings: Env
}>();


app.get('/', (c) => c.text("hiiiiii"))

const primaryID = 'primary'

app.get('/xrpc/com.atproto.label.subscribeLabels', (c) => {
  console.log({
    route: '/xrpc/com.atproto.label.subscribeLabels',
    queries: c.req.queries()
  })
  const upgradeHeader = c.req.header('Upgrade')
  if (!upgradeHeader || upgradeHeader != 'websocket') {
    c.status(426)
    return c.text('Expected Upgrade: websocket')
  }

  let id = c.env.SUBSCRIBE_LABELS_OBJECT.idFromName(primaryID)
  let stub = c.env.SUBSCRIBE_LABELS_OBJECT.get(id)

  return stub.fetch(c.req.raw)
})


// Verifying a service JWT
// helper method to resolve a user's DID to their atproto signing key
const idResolver = new IdResolver()
const getSigningKey = async (
  did: string,
  forceRefresh: boolean,
): Promise<string> => {
  return idResolver.did.resolveAtprotoKey(did, forceRefresh)
}

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['POST']
}))
app.use('/api/*', bearerAuth({
  verifyToken: async (token, c) => {
    try {
      console.log({ token })
      // TODO: SWITCH TO INCLUDING THE DID PREFIX IN THE ENV VARIABLE TO AVOID ISSUES LIKE THIS
      const payload = await verifyJwt(token, `did:${c.env.LABELER_DID}`, null, getSigningKey)
      c.set('did', payload.iss)
    } catch (e) {
      console.error(e)
      return false
    }
    return true
  }
}))
app.post('/api/request-label', async (c) => {
  const token = c.req.header('Token')

  if (token == undefined || token.length == 0) {
    c.status(401)
    return c.json({ error: "missing Token header" })
  }

  // TODO: replace with actual auth
  if (token !== c.env.SECRET_TMP_TOKEN) {
    c.status(500)
    return c.text('not ready yet...')
  }

  const latitude_string = c.req.query('lat')
  const longitude_string = c.req.query('lon')
  if (latitude_string == undefined || longitude_string == undefined) {
    c.status(400)
    return c.json({ error: "invalid / missing lat and lon query params" })
  }


  const cf_longitude_string = c.req.raw.cf?.longitude;
  const cf_latitude_string = c.req.raw.cf?.latitude;
  if (cf_longitude_string == undefined || cf_latitude_string == undefined) {
    c.status(500)
    return c.json({ error: "cloudflare did not estimate lat/lon for request" })
  }

  const latitude = parseFloat(latitude_string)
  const longitude = parseFloat(longitude_string)
  const cf_latitude = parseFloat(cf_latitude_string as string)
  const cf_longitude = parseFloat(cf_longitude_string as string)

  console.log({
    latitude, longitude, cf_latitude, cf_longitude
  })

  // turf is lon, lat
  const param_point = point([longitude, latitude])
  const cf_point = point([cf_longitude, cf_latitude])
  const estimatedDistanceMiles = distance(param_point, cf_point, { units: 'miles' });
  console.log({ estimatedDistanceMiles })

  if (estimatedDistanceMiles > 200) {
    c.status(400)
    return c.json({ error: 'ip estimated distance too far', estimatedDistanceMiles })
  }

  const headers = new Headers({
    "User-Agent": "Bluesky Location Labeler"
  })

  // https://nominatim.org/release-docs/latest/api/Reverse/
  // email included so nominatim can contact me if the usage is too much!
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?email=aviva@rubenfamily.com&format=jsonv2&addressdetails=1&zoom=10&lat=${latitude}&lon=${longitude}`, {
    "headers": headers,
    "body": null,
    "method": "GET"
  });
  const place = await resp.json() as Place | { error: string };
  console.log(place)
  if ('error' in place) {
    c.status(400)
    return c.json({ error: place.error })
  }
  const labelDefinition = buildLabelDefinition(place)
  await ensureLabelExists(c.env, labelDefinition)

  const templateLabel = prepareLabel({
    src: c.env.LABELER_DID,
    // aviva.gay
    target: c.get('did'),
  }, labelDefinition)

  const signedLabels = await signAndRecordLabelNegatingPrevious(c.env, templateLabel)
  const alreadyApplied = signedLabels.length === 0

  if (!alreadyApplied) {
    const id = c.env.SUBSCRIBE_LABELS_OBJECT.idFromName(primaryID)
    const stub = c.env.SUBSCRIBE_LABELS_OBJECT.get(id)

    await stub.announceLabels(signedLabels)
  }

  c.status(200)
  return c.json({ msg: (alreadyApplied ? 'applied' : 'already applied'), labelDefinition, estimatedDistanceMiles })
})

export default app;
export { SubscribeLabelsObject }
