import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { signalMapPoints } from '@features/location/lib/signal-map-points'

function signal(
	partial: Partial<LocationSignal> &
		Pick<LocationSignal, 'id' | 'status' | 'confidence'>,
): LocationSignal {
	return {
		label: partial.label ?? partial.id,
		summary: partial.summary ?? partial.id,
		raw: partial.raw ?? {},
		collectedAt: partial.collectedAt ?? '2026-01-01T00:00:00.000Z',
		...partial,
	}
}

describe('signalMapPoints', () => {
	it('uses GPS coordinates when present', () => {
		const points = signalMapPoints([
			signal({
				id: 'gps',
				status: 'ok',
				confidence: 0.9,
				lat: -23.55,
				lng: -46.63,
				accuracyMeters: 20,
			}),
		])

		expect(points).toHaveLength(1)
		expect(points[0]?.lat).toBe(-23.55)
		expect(points[0]?.lng).toBe(-46.63)
		expect(points[0]?.approximate).toBe(false)
	})

	it('maps country-only signals to centroids', () => {
		const points = signalMapPoints([
			signal({
				id: 'timezone',
				status: 'ok',
				confidence: 0.4,
				regionHints: {
					countryCodes: ['BR'],
					timezone: 'America/Sao_Paulo',
				},
			}),
			signal({
				id: 'ip_cloudflare',
				status: 'ok',
				confidence: 0.5,
				regionHints: { countryCodes: ['BR'] },
			}),
		])

		expect(points).toHaveLength(2)
		expect(points.every(point => point.approximate)).toBe(true)
		expect(points[0]?.lat).toBeDefined()
		expect(points[0]?.lng).toBeDefined()
	})

	it('skips signals without coords or country hints', () => {
		expect(
			signalMapPoints([
				signal({
					id: 'compass',
					status: 'ok',
					confidence: 0.1,
				}),
			]),
		).toEqual([])
	})

	it('returns empty for empty input', () => {
		expect(signalMapPoints([])).toEqual([])
	})
})
