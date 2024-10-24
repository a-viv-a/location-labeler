import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import { Hono } from "hono";
import {
  point,
  distance
} from "@turf/turf";
import { createLabel,  ensureLabelExists,  recordLabel } from "./atproto";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const app = new Hono<{
  Bindings: Env
}>();

// https://nominatim.org/release-docs/latest/api/Output/
type Place = {
  "place_id": string,
  "licence": string,
  "osm_type": string,
  "osm_id": string,
  "boundingbox": [string, string, string, string],
  "lat": string,
  "lon": string,
  // London, Greater London, England, SW1A 2DU, United Kingdom
  "display_name": string,
  "category": string,
  "type": string,
  "importance": number,
  "place_rank": number,
  "icon": string,
  "address": {
    "city": string,
    "state_district": string,
    "state": string,
    "ISO3166-2-lvl4": string,
    "postcode": string,
    "country": string,
    "country_code": string,
  },
};

const format_label = (city: string, iso: string) => {
  let s = iso.split('-')
  let country = s[0]
  let rest = s.slice(1).join('-')
  if (!hasFlag(country)) {
    return `${city} ${rest} ${country}`
  }

  return `${city} ${rest} ${getUnicodeFlagIcon(country)}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


app.get('/', (c) => c.text("hiiiiii"))
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

  const wsPair = new WebSocketPair();
  const [client, server] = Object.values(wsPair);

  server.accept();

  // we can hide in here, but only for ~30 seconds...
  c.executionCtx.waitUntil((async () => {
    // while(true) {
    //   await sleep(500)
    //   try {
    //     server.send("message")
    //   } catch(e) {
    //     console.log({e})
    //     continue;
    //   }
    //   break;
    // }
    console.log("sent message")
    await sleep(30_000)
    console.log("closing connection")
    server.close();
  })())

  return new Response(null, {
    status: 101,
    webSocket: client
  })
})
app.post('/evil-test', async (c) => {
  // await recordLabel(c.env, createLabel("TODO", {
  //   val: "test",
  //   uri: "uri",
  // }))

  await ensureLabelExists(c.env, {
    identifier: "test-three",
    en_locale_name: 'test 3',
    en_locale_desc: 'the third test!'
  })

  c.status(200)
})
app.post('/request-label', async (c) => {
  const token = c.req.header('Token')

  if (token == undefined || token.length == 0) {
    c.status(401)
    return c.json({ msg: "missing Token header" })
  }

  const latitude_string = c.req.query('lat')
  const longitude_string = c.req.query('lon')
  if (latitude_string == undefined || longitude_string == undefined) {
    c.status(400)
    return c.json({ msg: "invalid / missing lat and long query params" })
  }


  const cf_longitude_string = c.req.raw.cf?.longitude;
  const cf_latitude_string = c.req.raw.cf?.latitude;
  if (cf_longitude_string == undefined || cf_latitude_string == undefined) {
    c.status(500)
    return c.json({ msg: "cloudflare did not estimate lat/lon for request" })
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
  const estimated_distance_miles = distance(param_point, cf_point, { units: 'miles' });
  console.log({
    estimated_distance_miles
  })

  const headers = new Headers({
    "User-Agent": "Bluesky Location Labeler"
  })

  // https://nominatim.org/release-docs/latest/api/Reverse/
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&zoom=10&lat=${latitude}&lon=${longitude}`, {
    "headers": headers,
    "body": null,
    "method": "GET"
  });
  const place = await resp.json() as Place;

  const label = format_label(place.address.city, place.address['ISO3166-2-lvl4'])
  c.status(200)
  console.log(label)
  return c.json({ display_name: place.display_name, label, estimated_distance_miles })
})

export default app;
