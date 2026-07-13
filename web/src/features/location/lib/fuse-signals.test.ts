import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { fuseSignals } from '@features/location/lib/fuse-signals'

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

describe('fuseSignals', () => {
	it('weights GPS ahead of coarse IP coordinates', () => {
		const fused = fuseSignals([
			signal({
				id: 'gps',
				status: 'ok',
				confidence: 0.95,
				lat: -23.55,
				lng: -46.63,
				accuracyMeters: 20,
			}),
			signal({
				id: 'ip_ipwho',
				status: 'ok',
				confidence: 0.5,
				lat: -23.6,
				lng: -46.7,
				accuracyMeters: 80_000,
				regionHints: { countryCodes: ['BR'] },
			}),
		])

		expect(fused.lat).toBeDefined()
		expect(fused.lng).toBeDefined()
		expect(fused.lat ?? 0).toBeCloseTo(-23.55, 1)
		expect(fused.agreement).toBe('aligned')
		expect(fused.sourceIds).toContain('gps')
	})

	it('marks conflict when coordinate sources are far apart', () => {
		const fused = fuseSignals([
			signal({
				id: 'gps',
				status: 'ok',
				confidence: 0.9,
				lat: -23.55,
				lng: -46.63,
				accuracyMeters: 30,
				regionHints: { countryCodes: ['BR'] },
			}),
			signal({
				id: 'ip_ipwho',
				status: 'ok',
				confidence: 0.6,
				lat: 51.5,
				lng: -0.12,
				accuracyMeters: 50_000,
				regionHints: { countryCodes: ['GB'] },
			}),
		])

		expect(fused.agreement).toBe('conflicted')
		expect(fused.summary).toMatch(/Conflito/)
	})

	it('falls back to sparse country centroid without coordinates', () => {
		const fused = fuseSignals([
			signal({
				id: 'ip_cloudflare',
				status: 'ok',
				confidence: 0.5,
				regionHints: { countryCodes: ['BR'] },
			}),
			signal({
				id: 'timezone',
				status: 'ok',
				confidence: 0.4,
				regionHints: { countryCodes: ['BR'], timezone: 'America/Sao_Paulo' },
			}),
		])

		expect(fused.agreement).toBe('sparse')
		expect(fused.lat).toBeDefined()
		expect(fused.lng).toBeDefined()
	})
})
