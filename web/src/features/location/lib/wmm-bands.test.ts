import { describe, expect, it } from 'vitest'

import {
	evaluateMagneticConsistency,
	fieldMatchesCountryBand,
	magneticFieldMagnitudeUt,
} from '@features/location/lib/wmm-bands'

describe('wmm-bands', () => {
	it('computes magnitude from vector components', () => {
		expect(magneticFieldMagnitudeUt(3, 4, 0)).toBe(5)
	})

	it('matches Brazil intensities and flags London VPN mismatch', () => {
		expect(fieldMatchesCountryBand(27, 'BR')).toBe(true)
		expect(fieldMatchesCountryBand(55, 'BR')).toBe(false)
		expect(fieldMatchesCountryBand(48, 'GB')).toBe(true)

		const evaluation = evaluateMagneticConsistency({
			magnitudeUt: 27,
			countryCodes: ['GB'],
		})
		expect(evaluation.conflicted).toBe(true)
		expect(evaluation.incompatibleCountries).toContain('GB')
	})
})
