import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ForensicsPanel } from '@features/location/components/ForensicsPanel'

import { renderWithProviders } from '@/test/test-utils'

describe('ForensicsPanel', () => {
	it('renders fused summary and expands signal evidence', async () => {
		const user = userEvent.setup()

		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalId={null}
				onSelectSignal={() => undefined}
				onToggle={() => undefined}
				fused={{
					agreement: 'aligned',
					summary: 'Posição fundida de teste.',
					confidence: 0.8,
					sourceIds: ['gps'],
					lat: -23.55,
					lng: -46.63,
					accuracyMeters: 30,
				}}
				signals={[
					{
						id: 'gps',
						label: 'GPS / GNSS',
						status: 'ok',
						confidence: 0.9,
						summary: 'Alta precisão',
						raw: { accuracy: 12 },
						collectedAt: '2026-01-01T00:00:00.000Z',
						lat: -23.55,
						lng: -46.63,
						accuracyMeters: 12,
					},
				]}
			/>,
		)

		expect(
			screen.getAllByText('Posição fundida de teste.').length,
		).toBeGreaterThan(0)
		expect(screen.getByText('GPS / GNSS')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /GPS \/ GNSS/i }))
	})

	it('moves browser-blocked signals to the end with red strikethrough', () => {
		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalId={null}
				onSelectSignal={() => undefined}
				onToggle={() => undefined}
				signals={[
					{
						id: 'gps',
						label: 'GPS / GNSS',
						status: 'denied',
						confidence: 0,
						summary: 'Permissão de localização negada.',
						raw: { code: 1 },
						collectedAt: '2026-01-01T00:00:00.000Z',
					},
					{
						id: 'timezone',
						label: 'Fuso horário (IANA)',
						status: 'ok',
						confidence: 0.4,
						summary: 'Fuso America/Sao_Paulo',
						raw: {},
						collectedAt: '2026-01-01T00:00:00.000Z',
					},
				]}
			/>,
		)

		const items = screen.getAllByRole('listitem')
		expect(items).toHaveLength(2)
		expect(items[0]).toHaveTextContent('Fuso horário (IANA)')
		expect(items[1]).toHaveTextContent('GPS / GNSS')

		const blockedLabel = screen.getByText('GPS / GNSS')
		expect(blockedLabel.className).toContain('line-through')
		expect(blockedLabel.className).toContain('text-rose-500')
	})
})
