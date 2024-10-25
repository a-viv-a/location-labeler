import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import { LabelDefinition, Place } from "./types";
import { defined } from "./util";


const enLocaleName = ({ name, address: { 'ISO3166-2-lvl4': iso } }: Place) => {
  // TODO: make this not evil?
  let s = iso.split('-')
  let country = s[0]
  let rest = s.slice(1).join('-')
  if (!hasFlag(country)) {
    return defined`${name} ${rest} ${country}`
  }

  return defined`${name} ${rest} ${getUnicodeFlagIcon(country)}`
}

const enLocaleDesc = ({ display_name }: Pick<Place, 'display_name'>) => defined`${display_name}`


/**
https://nominatim.org/release-docs/latest/api/Output/#place_id-is-not-a-persistent-id

"If you need an ID that is consistent... then you should use the combination of osm_type+osm_id+class"

class renamed to category...
*/
export const identifier = (place: Place) => defined`${place.osm_type}-${place.osm_id}-${place.category}`

export const build_label_definition = (place: Place): LabelDefinition => ({
  en_locale_name: enLocaleName(place),
  en_locale_desc: enLocaleDesc(place),
  identifier: identifier(place)
})
