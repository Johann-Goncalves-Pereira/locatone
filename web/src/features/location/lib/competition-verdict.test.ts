import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import { competitionVerdict } from '@features/location/lib/competition-verdict'

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

describe('competitionVerdict', () => {
	it('flags Accept-Language / speech BR leaks under Tallinn IP story', () => {
		const result = competitionVerdict([
			signal({
				id: 'ip_cloudflare',
				status: 'ok',
				confidence: 0.5,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'timezone',
				status: 'ok',
				confidence: 0.4,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'accept_language',
				status: 'ok',
				confidence: 0.6,
				regionHints: { countryCodes: ['BR'] },
				raw: { mismatch: true },
			}),
			signal({
				id: 'speech_voices',
				status: 'ok',
				confidence: 0.6,
				regionHints: { countryCodes: ['BR'] },
				raw: { hasPtBr: true },
			}),
		])

		expect(result.kind).toBe('brazil_leak')
		expect(result.label).toMatch(/BR/i)
		expect(result.leakSources).toEqual(
			expect.arrayContaining(['Accept-Language', 'vozes']),
		)
	})

	it('reports Tallinn consensus when leaks are absent', () => {
		const result = competitionVerdict([
			signal({
				id: 'timezone',
				status: 'ok',
				confidence: 0.4,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'locale',
				status: 'ok',
				confidence: 0.3,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'accept_language',
				status: 'ok',
				confidence: 0.4,
				regionHints: { countryCodes: ['EE'] },
				raw: { mismatch: false },
			}),
			signal({
				id: 'ip_vs_tz',
				status: 'ok',
				confidence: 0.25,
				raw: { conflicted: false },
			}),
		])

		expect(result.kind).toBe('aligned_spoof')
		expect(result.label).toMatch(/Tallinn/i)
	})
})
