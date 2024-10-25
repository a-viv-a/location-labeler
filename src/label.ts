import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import { LabelDefinition } from "./atproto";
import AlphanumericEncoder from "alphanumeric-encoder";
import { Place } from "./types";

const enLocaleName = ({ city, iso }: { city: string, iso: string }) => {
  let s = iso.split('-')
  let country = s[0]
  let rest = s.slice(1).join('-')
  if (!hasFlag(country)) {
    return `${city} ${rest} ${country}`
  }

  return `${city} ${rest} ${getUnicodeFlagIcon(country)}`
}

const enLocaleDesc = ({ city, iso }: { city: string, iso: string }) => `located in ${city}, ${iso}`

const encoder = new AlphanumericEncoder();

const normalize = (str: string) =>
  str.normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z-]/g, "").toLowerCase()

export const identifier = ({ city, iso }: { city: string, iso: string }) => normalize(`${iso}-${city}`.replaceAll(/\d+/g, n =>
  (encoder.encode(parseInt(n) + 1) ?? 'nan')
))

export const build_label_definition = (place: Place): LabelDefinition => ({
  en_locale_name: enLocaleName(location),
  en_locale_desc: enLocaleDesc(location),
  identifier: identifier(location)
})
