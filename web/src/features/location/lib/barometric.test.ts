import { describe, expect, it } from 'vitest'

import {
	altitudeAgreesWithPressure,
	elevationFromPressureHpa,
} from '@features/location/lib/barometric'

describe('barometric', () => {
	it('maps sea-level pressure near 0 m elevation', () => {
		expect(elevationFromPressureHpa(1013.25)).toBeCloseTo(0, 0)
	})

	it('increases elevation as pressure drops', () => {
		expect(elevationFromPressureHpa(900)).toBeGreaterThan(800)
	})

	it('compares GPS altitude to pressure elevation', () => {
		expect(
			altitudeAgreesWithPressure({
				gpsAltitudeMeters: 100,
				pressureElevationMeters: 110,
			}),
		).toBe(true)
		expect(
			altitudeAgreesWithPressure({
				gpsAltitudeMeters: 100,
				pressureElevationMeters: 400,
			}),
		).toBe(false)
	})
})
