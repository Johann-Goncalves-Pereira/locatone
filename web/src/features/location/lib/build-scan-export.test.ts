import { describe, expect, it } from 'vitest'

import { buildScanExportPayload } from '@features/location/lib/build-scan-export'

describe('buildScanExportPayload', () => {
	it('serializes fused summary and signals as parseable JSON', () => {
		const text = buildScanExportPayload({
			url: 'https://example.test/',
			userAgent: 'TestAgent',
			collectedAt: '2026-01-01T00:00:00.000Z',
			fused: {
				agreement: 'aligned',
				summary: 'ok',
				confidence: 0.8,
				sourceIds: ['gps'],
				lat: 1,
				lng: 2,
			},
			signals: [
				{
					id: 'gps',
					label: 'GPS / GNSS',
					status: 'ok',
					confidence: 0.9,
					summary: 'fixado',
					raw: { accuracy: 12 },
					collectedAt: '2026-01-01T00:00:00.000Z',
					lat: 1,
					lng: 2,
					accuracyMeters: 12,
				},
			],
		})

		const parsed: unknown = JSON.parse(text)
		expect(parsed).toMatchObject({
			url: 'https://example.test/',
			userAgent: 'TestAgent',
			fused: { agreement: 'aligned', sourceIds: ['gps'] },
			signals: [{ id: 'gps', status: 'ok', raw: { accuracy: 12 } }],
		})
	})
})
