import { describe, expect, it } from 'vitest'

import type { LocationSignal } from '@features/location/api/location.schema'
import {
	agreementLabel,
	groupSignalsBySection,
	sortSignalsForPanel,
} from '@features/location/lib/signal-panel'

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

describe('signal-panel', () => {
	it('translates agreement enums to Portuguese labels', () => {
		expect(agreementLabel('aligned')).toBe('Alinhado')
		expect(agreementLabel('conflicted')).toBe('Em conflito')
		expect(agreementLabel('sparse')).toBe('Esparso')
	})

	it('orders coordinates before priors and denied last', () => {
		const ordered = sortSignalsForPanel([
			signal({
				id: 'timezone',
				status: 'ok',
				confidence: 0.4,
				label: 'Fuso',
			}),
			signal({
				id: 'gps',
				status: 'denied',
				confidence: 0,
				label: 'GPS',
			}),
			signal({
				id: 'ip_vs_tz',
				status: 'ok',
				confidence: 0.3,
				label: 'Conflito',
			}),
			signal({
				id: 'permission_state',
				status: 'ok',
				confidence: 0.1,
				label: 'Permissão',
			}),
			signal({
				id: 'network_geo',
				status: 'ok',
				confidence: 0.5,
				label: 'Rede',
			}),
		])

		expect(ordered.map(item => item.id)).toEqual([
			'network_geo',
			'timezone',
			'ip_vs_tz',
			'permission_state',
			'gps',
		])
	})

	it('groups signals by forensic section', () => {
		const groups = groupSignalsBySection([
			signal({ id: 'timezone', status: 'ok', confidence: 0.4 }),
			signal({ id: 'gps', status: 'ok', confidence: 0.9 }),
			signal({ id: 'compass', status: 'ok', confidence: 0.1 }),
		])

		expect(groups.map(group => group.key)).toEqual([
			'coordinates',
			'priors',
			'metadata',
		])
	})

	it('uses a denied group key for blocked signals', () => {
		const groups = groupSignalsBySection([
			signal({ id: 'gps', status: 'denied', confidence: 0 }),
			signal({ id: 'timezone', status: 'ok', confidence: 0.4 }),
		])

		expect(groups.map(group => group.key)).toEqual(['priors', 'denied'])
	})
})
