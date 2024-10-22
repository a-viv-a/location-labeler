import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import { Hono } from "hono";

/**
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const app = new Hono();

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

app.get('/', (c) => c.text("hiiiiii"))
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

  const latitude = parseFloat(latitude_string)
  const longitude = parseFloat(longitude_string)

  const headers = new Headers({
    "User-Agent": "Bluesky Location Labeler"
  })

  // https://nominatim.org/release-docs/latest/api/Reverse/
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&zoom=10&lat=${latitude}&lon=${longitude}`, {
    "headers": headers,
    "body": null,
    "method": "GET"
  });
  console.log(resp.body)
  const place = await resp.json() as Place;

  const label = format_label(place.address.city, place.address['ISO3166-2-lvl4'])
  c.status(200)
  console.log(label)
  return c.json({ display_name: place.display_name })
})

export default app;
