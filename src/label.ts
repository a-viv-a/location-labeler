import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import AlphanumericEncoder from "alphanumeric-encoder";
import { LabelDefinition, Place } from "./types";

type CityISO = Pick<Place['address'], 'city' | 'ISO3166-2-lvl4'>;

const def = <T>(v: T): T => {
  if (v === undefined || v === null) throw new Error(`Expected a defined key in place response but found ${v}`)
  return v
}

const enLocaleName = ({ city, 'ISO3166-2-lvl4': iso }: CityISO) => {
  let s = iso.split('-')
  let country = s[0]
  let rest = s.slice(1).join('-')
  if (!hasFlag(country)) {
    return `${def(city)} ${def(rest)} ${def(country)}`
  }

  return `${def(city)} ${def(rest)} ${getUnicodeFlagIcon(country)}`
}

const enLocaleDesc = ({ display_name }: Pick<Place, 'display_name'>) => def(display_name)

const encoder = new AlphanumericEncoder();

const normalize = (str: string) =>
  str.normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z-]/g, "").toLowerCase()

export const identifier = ({ city, 'ISO3166-2-lvl4': iso }: CityISO) => normalize(`${def(iso)}-${def(city)}`.replaceAll(/\d+/g, n =>
  (encoder.encode(parseInt(n) + 1) ?? 'nan')
))

export const build_label_definition = (place: Place): LabelDefinition => ({
  en_locale_name: enLocaleName(place.address),
  en_locale_desc: enLocaleDesc(place),
  identifier: identifier(place.address)
})
