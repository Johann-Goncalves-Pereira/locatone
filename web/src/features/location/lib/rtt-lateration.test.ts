import { describe, expect, it } from 'vitest'

import {
	rttMsToDistanceKm,
	softLaterateFromRtt,
} from '@features/location/lib/rtt-lateration'

describe('rtt-lateration', () => {
	it('maps RTT to a capped soft distance', () => {
		expect(rttMsToDistanceKm(10)).toBeGreaterThan(0)
		expect(rttMsToDistanceKm(10)).toBeLessThan(rttMsToDistanceKm(200))
		expect(rttMsToDistanceKm(100_000)).toBe(20_000)
	})

	it('soft-laterates with at least two landmarks', () => {
		const result = softLaterateFromRtt([
			{
				id: 'br',
				lat: -15.78,
				lng: -47.93,
				countryCodes: ['BR'],
				rttMs: 40,
			},
			{
				id: 'us',
				lat: 38.88,
				lng: -77.01,
				countryCodes: ['US'],
				rttMs: 180,
			},
			{
				id: 'jp',
				lat: 35.68,
				lng: 139.76,
				countryCodes: ['JP'],
				rttMs: 280,
			},
		])

		expect(result).toBeDefined()
		expect(result?.confidence).toBeLessThanOrEqual(0.25)
		expect(result?.accuracyMeters).toBeGreaterThanOrEqual(500_000)
		expect(result?.lat).toBeTypeOf('number')
		expect(result?.lng).toBeTypeOf('number')
	})

	it('returns undefined with a single landmark', () => {
		expect(
			softLaterateFromRtt([
				{
					id: 'br',
					lat: -15.78,
					lng: -47.93,
					countryCodes: ['BR'],
					rttMs: 40,
				},
			]),
		).toBeUndefined()
	})
})
