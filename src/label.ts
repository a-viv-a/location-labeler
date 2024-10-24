import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import { LabelDefinition } from "./atproto";
import AlphanumericEncoder from "alphanumeric-encoder";

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

const numberRegex = /\d+/g
const encoder = new AlphanumericEncoder();

const normalize = (str: string) =>
  str.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase()

export const identifier = ({ city, iso }: { city: string, iso: string }) => normalize(`${iso}-${city}`.replaceAll(numberRegex, n =>
  (encoder.encode(parseInt(n) + 1) ?? 'nan')
))

export const build_label_definition = (location: { city: string, iso: string }): LabelDefinition => ({
  en_locale_name: enLocaleName(location),
  en_locale_desc: enLocaleDesc(location),
  identifier: identifier(location)
})
