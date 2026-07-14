import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { haversineKm } from '@features/location/lib/geo-distance'
import { runStorageGpsConflictProbe } from '@features/location/probes/run-storage-conflict'

function okCoords(
	id: LocationSignal['id'],
	lat: number,
	lng: number,
): LocationSignal {
	return {
		id,
		label: id,
		status: 'ok',
		confidence: 0.5,
		lat,
		lng,
		accuracyMeters: 20,
		summary: id,
		raw: {},
		collectedAt: '2026-07-14T00:00:00.000Z',
	}
}

describe('runStorageGpsConflictProbe', () => {
	it('flags Mandirituba vs Tallinn session conflict', () => {
		const gps = okCoords('gps', 59.457528, 24.697444)
		const stored = okCoords('storage_echo', -25.872917, -49.410583)
		const result = runStorageGpsConflictProbe(gps, stored)
		expect(result.raw).toMatchObject({ conflicted: true })
		expect(
			haversineKm(59.457528, 24.697444, -25.872917, -49.410583),
		).toBeGreaterThan(150)
	})

	it('stays quiet when close', () => {
		const gps = okCoords('gps', 59.457528, 24.697444)
		const stored = okCoords('storage_echo', 59.458, 24.698)
		const result = runStorageGpsConflictProbe(gps, stored)
		expect(result.raw).toMatchObject({ conflicted: false })
	})
})
