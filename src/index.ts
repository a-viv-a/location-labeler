import { Hono } from "hono";
import {
  point,
  distance
} from "@turf/turf";
import { prepareLabel, ensureLabelExists, signAndRecordLabel } from "./atproto";
import { build_label_definition as buildLabelDefinition } from "./label";
import { sleep } from "./util";
import { Place } from "./types";

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
app.post('/evil-test', async (c) => {
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
    return c.json({ msg: "invalid / missing lat and lon query params" })
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
  const estimatedDistanceMiles = distance(param_point, cf_point, { units: 'miles' });
  console.log({ estimatedDistanceMiles })

  const headers = new Headers({
    "User-Agent": "Bluesky Location Labeler"
  })

  // https://nominatim.org/release-docs/latest/api/Reverse/
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?email=aviva@rubenfamily.com&format=jsonv2&addressdetails=1&zoom=10&lat=${latitude}&lon=${longitude}`, {
    "headers": headers,
    "body": null,
    "method": "GET"
  });
  const place = await resp.json() as Place;
  console.log(place)
  const labelDefinition = buildLabelDefinition(place)
  await ensureLabelExists(c.env, labelDefinition)

  const unsignedLabel = prepareLabel({
    src: c.env.LABELER_DID,
    // aviva.gay
    target: 'plc:jx4g6baqkwdlonylsetvpu7c',
  }, labelDefinition)

  const signedLabel = await signAndRecordLabel(c.env, unsignedLabel)
  
  c.status(200)
  return c.json({ labelDefinition, estimatedDistanceMiles })
})

export default app;
