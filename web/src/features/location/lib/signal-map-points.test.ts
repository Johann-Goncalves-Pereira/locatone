import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import {
	CAMERA_ACCURACY_MAX_METERS,
	CIRCLE_DRAW_MAX_METERS,
	cameraFocusLatLngs,
	formatAccuracyMeters,
	isPriorityCameraPoint,
	shouldDrawAccuracyCircle,
	signalMapPoints,
} from '@features/location/lib/signal-map-points'

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

describe('accuracy circle and camera helpers', () => {
	it('hides mega circles unless selected', () => {
		const [point] = signalMapPoints([
			signal({
				id: 'rtt_probe',
				status: 'ok',
				confidence: 0.2,
				lat: 0,
				lng: 0,
				accuracyMeters: 4_000_000,
			}),
		])

		expect(point).toBeDefined()
		if (point === undefined) {
			return
		}
		expect(point.accuracyMeters).toBeGreaterThan(CIRCLE_DRAW_MAX_METERS)
		expect(shouldDrawAccuracyCircle(point, false)).toBe(false)
		expect(shouldDrawAccuracyCircle(point, true)).toBe(true)
		expect(isPriorityCameraPoint(point)).toBe(false)
	})

	it('keeps precise points in the default camera set', () => {
		const points = signalMapPoints([
			signal({
				id: 'ip_ipwho',
				status: 'ok',
				confidence: 0.6,
				lat: -25.5,
				lng: -49.2,
				accuracyMeters: 80_000,
			}),
			signal({
				id: 'rtt_probe',
				status: 'ok',
				confidence: 0.2,
				lat: 5,
				lng: 10,
				accuracyMeters: CAMERA_ACCURACY_MAX_METERS + 1,
			}),
		])

		const focus = cameraFocusLatLngs(points, undefined, [])
		expect(focus).toHaveLength(1)
		expect(focus[0]?.lat).toBe(-25.5)
		expect(focus[0]?.lng).toBe(-49.2)
	})

	it('includes fused point in camera focus', () => {
		const points = signalMapPoints([
			signal({
				id: 'rtt_probe',
				status: 'ok',
				confidence: 0.2,
				lat: 5,
				lng: 10,
				accuracyMeters: 4_000_000,
			}),
		])

		const focus = cameraFocusLatLngs(
			points,
			{
				agreement: 'conflicted',
				summary: 'Conflito',
				confidence: 0.3,
				sourceIds: ['rtt_probe'],
				lat: -25.4,
				lng: -49.1,
				accuracyMeters: 90_000,
			},
			[],
		)

		expect(focus).toEqual([{ lat: -25.4, lng: -49.1 }])
	})

	it('prefers selected probes for camera focus', () => {
		const points = signalMapPoints([
			signal({
				id: 'ip_ipwho',
				status: 'ok',
				confidence: 0.6,
				lat: -25.5,
				lng: -49.2,
				accuracyMeters: 80_000,
			}),
			signal({
				id: 'rtt_probe',
				status: 'ok',
				confidence: 0.2,
				lat: 5,
				lng: 10,
				accuracyMeters: 4_000_000,
			}),
		])

		const focus = cameraFocusLatLngs(points, undefined, ['rtt_probe'])
		expect(focus).toEqual([{ lat: 5, lng: 10 }])
	})

	it('formats accuracy in meters or kilometers', () => {
		expect(formatAccuracyMeters(30)).toBe('±30 m')
		expect(formatAccuracyMeters(96025)).toBe('±96 km')
	})
})
