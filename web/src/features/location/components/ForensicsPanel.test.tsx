import { useState } from 'react'

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { ProbeId } from '@features/location/api/location.schema'
import { ForensicsPanel } from '@features/location/components/ForensicsPanel'

import { renderWithProviders } from '@/test/test-utils'

describe('ForensicsPanel', () => {
	it('renders fused summary and expands signal evidence', async () => {
		const user = userEvent.setup()

		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
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
		expect(screen.getByText(/Fusão · Alinhado/i)).toBeInTheDocument()
		expect(screen.getByText('GPS / GNSS')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /GPS \/ GNSS/i }))
	})

	it('shows Portuguese conflict agreement on the fusion card', () => {
		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
				onToggle={() => undefined}
				fused={{
					agreement: 'conflicted',
					summary: 'Conflito espacial de teste.',
					confidence: 0.4,
					sourceIds: ['gps', 'ip_ipwho'],
				}}
				signals={[]}
			/>,
		)

		expect(screen.getByText(/Fusão · Em conflito/i)).toBeInTheDocument()
		expect(screen.getByText(/2 fontes/i)).toBeInTheDocument()
	})

	it('exposes panel toggle accessibility attributes', () => {
		renderWithProviders(
			<ForensicsPanel
				open={false}
				isCollecting={false}
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
				onToggle={() => undefined}
				signals={[]}
			/>,
		)

		expect(
			screen.getByRole('button', { name: /Painel forense/i }),
		).toHaveAttribute('aria-expanded', 'false')
	})

	it('moves browser-blocked signals to the end with red strikethrough', () => {
		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
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

	it('keeps multiple signal cards expanded at once', async () => {
		const user = userEvent.setup()

		function MultiSelectHarness() {
			const [selected, setSelected] = useState<readonly ProbeId[]>([])
			return (
				<ForensicsPanel
					open
					isCollecting={false}
					selectedSignalIds={selected}
					onToggleSignal={id => {
						setSelected(current =>
							current.includes(id)
								? current.filter(item => item !== id)
								: [...current, id],
						)
					}}
					onToggle={() => undefined}
					signals={[
						{
							id: 'gps',
							label: 'GPS / GNSS',
							status: 'ok',
							confidence: 0.9,
							summary: 'Alta precisão',
							raw: { kind: 'gps' },
							collectedAt: '2026-01-01T00:00:00.000Z',
							lat: -23.55,
							lng: -46.63,
							accuracyMeters: 12,
						},
						{
							id: 'network_geo',
							label: 'Wi‑Fi / celular (via navegador)',
							status: 'ok',
							confidence: 0.5,
							summary: 'Rede',
							raw: { kind: 'network' },
							collectedAt: '2026-01-01T00:00:00.000Z',
							lat: -23.56,
							lng: -46.64,
							accuracyMeters: 1200,
						},
					]}
				/>
			)
		}

		renderWithProviders(<MultiSelectHarness />)

		await user.click(screen.getByRole('button', { name: /GPS \/ GNSS/i }))
		await user.click(screen.getByRole('button', { name: /Wi‑Fi \/ celular/i }))

		expect(screen.getByText(/"kind": "gps"/)).toBeInTheDocument()
		expect(screen.getByText(/"kind": "network"/)).toBeInTheDocument()
		expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
	})
})
