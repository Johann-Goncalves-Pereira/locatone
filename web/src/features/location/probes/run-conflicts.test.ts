import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { runIpVsTzProbe } from '@features/location/probes/run-conflicts'

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

describe('runIpVsTzProbe', () => {
	it('flags magnetic or solar mismatch as conflict evidence', () => {
		const result = runIpVsTzProbe([
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
				regionHints: { countryCodes: ['BR'] },
			}),
			signal({
				id: 'locale',
				status: 'ok',
				confidence: 0.3,
				regionHints: { countryCodes: ['BR'] },
			}),
			signal({
				id: 'magnetometer',
				status: 'ok',
				confidence: 0.35,
				raw: { conflicted: true },
			}),
			signal({
				id: 'color_scheme_solar',
				status: 'ok',
				confidence: 0.28,
				raw: { mismatch: true },
			}),
		])

		expect(result.raw).toMatchObject({
			conflicted: true,
			magneticConflict: true,
			solarMismatch: true,
			regionConflicted: false,
		})
		expect(result.summary).toMatch(/magnético|solar/i)
	})
})
