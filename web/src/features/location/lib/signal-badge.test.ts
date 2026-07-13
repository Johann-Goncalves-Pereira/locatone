import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { signalBadgeLabel } from '@features/location/lib/signal-badge'

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

describe('signalBadgeLabel', () => {
	it('omits confidence when there is no location contribution', () => {
		expect(
			signalBadgeLabel(
				signal({
					id: 'permission_state',
					status: 'ok',
					confidence: 0.1,
				}),
			),
		).toBe('ok')

		expect(
			signalBadgeLabel(
				signal({
					id: 'storage_echo',
					status: 'ok',
					confidence: 0.05,
				}),
			),
		).toBe('ok')
	})

	it('shows confiança % only for location-bearing signals', () => {
		expect(
			signalBadgeLabel(
				signal({
					id: 'gps',
					status: 'ok',
					confidence: 0.9,
					lat: -23.55,
					lng: -46.63,
				}),
			),
		).toBe('ok · confiança 90%')

		expect(
			signalBadgeLabel(
				signal({
					id: 'timezone',
					status: 'ok',
					confidence: 0.4,
					regionHints: { countryCodes: ['BR'] },
				}),
			),
		).toBe('ok · confiança 40%')
	})

	it('shows status alone when denied', () => {
		expect(
			signalBadgeLabel(
				signal({
					id: 'gps',
					status: 'denied',
					confidence: 0,
				}),
			),
		).toBe('negado')
	})
})
