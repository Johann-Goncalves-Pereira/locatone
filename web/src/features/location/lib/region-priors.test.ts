import { describe, expect, it } from 'vitest'

import {
	countriesFromLocale,
	countriesFromTimezone,
	countryFromTld,
	intersectCountryCodes,
} from '@features/location/lib/region-priors'

describe('region-priors', () => {
	it('maps known timezones to countries', () => {
		expect(countriesFromTimezone('America/Sao_Paulo')).toEqual(['BR'])
		expect(countriesFromTimezone('Europe/Berlin')).toEqual(['DE'])
	})

	it('maps locales to countries', () => {
		expect(countriesFromLocale('pt-BR')).toEqual(['BR'])
		expect(countriesFromLocale('ja-JP')).toEqual(['JP'])
	})

	it('extracts country hints from TLDs', () => {
		expect(countryFromTld('news.uol.com.br')).toBe('BR')
		expect(countryFromTld('www.bbc.co.uk')).toBe('GB')
	})

	it('intersects country code groups', () => {
		expect(
			intersectCountryCodes([
				['BR', 'US'],
				['BR', 'AR'],
			]),
		).toEqual(['BR'])
		expect(intersectCountryCodes([['BR'], ['US']])).toEqual([])
	})
})
