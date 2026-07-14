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

	it('flags Date#toString and Worker leaks as conflict evidence', () => {
		const result = runIpVsTzProbe([
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
				id: 'locale',
				status: 'ok',
				confidence: 0.3,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'date_string_tz',
				status: 'ok',
				confidence: 0.5,
				regionHints: { countryCodes: ['BR'] },
				raw: { offsetMismatch: true },
			}),
			signal({
				id: 'worker_intl',
				status: 'ok',
				confidence: 0.5,
				regionHints: { countryCodes: ['BR'] },
				raw: { mismatch: true },
			}),
			signal({
				id: 'ip_sanity',
				status: 'ok',
				confidence: 0.5,
				raw: { suspicious: true },
			}),
		])

		expect(result.raw).toMatchObject({
			conflicted: true,
			dateStringLeak: true,
			workerMismatch: true,
			ipSanityConflict: true,
		})
	})

	it('flags Accept-Language, speech, iframe and SW leaks', () => {
		const result = runIpVsTzProbe([
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
				id: 'locale',
				status: 'ok',
				confidence: 0.3,
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
				raw: { hasPtBr: true },
			}),
			signal({
				id: 'iframe_intl',
				status: 'ok',
				confidence: 0.6,
				raw: { mismatch: true },
			}),
			signal({
				id: 'service_worker_intl',
				status: 'ok',
				confidence: 0.6,
				raw: { mismatch: true },
			}),
		])

		expect(result.raw).toMatchObject({
			conflicted: true,
			acceptLanguageMismatch: true,
			speechBrazilLeak: true,
			iframeMismatch: true,
			serviceWorkerMismatch: true,
		})
		expect(result.summary).toMatch(/Accept-Language|vozes|iframe|SW/i)
	})

	it('flags HTTP Worker BR leak and flat RTT neutralize', () => {
		const result = runIpVsTzProbe([
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
				id: 'locale',
				status: 'ok',
				confidence: 0.3,
				regionHints: { countryCodes: ['EE'] },
			}),
			signal({
				id: 'http_worker_intl',
				status: 'ok',
				confidence: 0.58,
				regionHints: {
					countryCodes: ['BR'],
					timezone: 'America/Sao_Paulo',
				},
				raw: { mismatch: true },
			}),
			signal({
				id: 'rtt_probe',
				status: 'ok',
				confidence: 0.38,
				raw: { flatNeutralized: true },
			}),
		])

		expect(result.raw).toMatchObject({
			conflicted: true,
			httpWorkerMismatch: true,
			workerBrLeak: true,
			rttNeutralized: true,
		})
		expect(result.regionHints?.countryCodes).toContain('BR')
		expect(result.confidence).toBeGreaterThanOrEqual(0.55)
		expect(result.summary).toMatch(/Worker|RTT/i)
	})
})
