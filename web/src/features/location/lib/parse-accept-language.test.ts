import { describe, expect, it } from 'vitest'

import {
	countriesFromAcceptLanguage,
	parseAcceptLanguageTags,
} from '@features/location/lib/parse-accept-language'

describe('parseAcceptLanguageTags', () => {
	it('strips q-weights and normalizes tags', () => {
		expect(
			parseAcceptLanguageTags('pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'),
		).toEqual(['pt-BR', 'pt', 'en-US', 'en'])
	})
})

describe('countriesFromAcceptLanguage', () => {
	it('maps Brazilian Accept-Language to BR', () => {
		expect(countriesFromAcceptLanguage('pt-BR,pt;q=0.9')).toEqual(
			expect.arrayContaining(['BR']),
		)
		expect(countriesFromAcceptLanguage('pt-BR')).toEqual(['BR'])
	})

	it('maps Estonian Accept-Language to EE', () => {
		expect(countriesFromAcceptLanguage('et-EE,et;q=0.9,en-US;q=0.8')).toEqual([
			'EE',
			'US',
		])
	})
})
