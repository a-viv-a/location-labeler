// https://nominatim.org/release-docs/latest/api/Output/
export type Place = {
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


