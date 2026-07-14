import { describe, expect, it } from 'vitest'

import {
	expectedThemeFromSolar,
	isCivilNight,
	solarElevationDegrees,
} from '@features/location/lib/solar-elevation'

describe('solar-elevation', () => {
	it('reports high noon elevation near equator', () => {
		const noon = new Date(Date.UTC(2026, 2, 21, 12, 0, 0))
		const elevation = solarElevationDegrees(0, 0, noon)
		expect(elevation).toBeGreaterThan(50)
		expect(isCivilNight(elevation)).toBe(false)
		expect(expectedThemeFromSolar(elevation)).toBe('light')
	})

	it('reports night for midnight UTC at meridian', () => {
		const midnight = new Date(Date.UTC(2026, 2, 21, 0, 0, 0))
		const elevation = solarElevationDegrees(0, 0, midnight)
		expect(elevation).toBeLessThan(-6)
		expect(expectedThemeFromSolar(elevation)).toBe('dark')
	})
})
