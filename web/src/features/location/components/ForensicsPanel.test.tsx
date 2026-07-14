import { useState } from 'react'

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ProbeId } from '@features/location/api/location.schema'
import { ForensicsPanel } from '@features/location/components/ForensicsPanel'

import { renderWithProviders } from '@/test/test-utils'

describe('ForensicsPanel', () => {
	it('renders fused summary and expands signal evidence on demand', async () => {
		const user = userEvent.setup()

		function SelectionHarness() {
			const [selected, setSelected] = useState<readonly ProbeId[]>([])
			return (
				<ForensicsPanel
					open
					isCollecting={false}
					hasStarted
					selectedSignalIds={selected}
					onToggleSignal={id => {
						setSelected(current =>
							current.includes(id)
								? current.filter(item => item !== id)
								: [...current, id],
						)
					}}
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
				/>
			)
		}

		renderWithProviders(<SelectionHarness />)

		expect(
			screen.getAllByText('Posição fundida de teste.').length,
		).toBeGreaterThan(0)
		expect(screen.getByText('Fusão')).toBeInTheDocument()
		expect(screen.getByText('Alinhado')).toBeInTheDocument()
		expect(screen.getByText('GPS / GNSS')).toBeInTheDocument()
		expect(screen.getByText(/±30 m/)).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /GPS \/ GNSS/i }))
		expect(screen.queryByText(/"accuracy": 12/)).not.toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /^Evidência bruta$/i }))
		expect(screen.getByText(/"accuracy": 12/)).toBeInTheDocument()
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

		expect(screen.getByText('Fusão')).toBeInTheDocument()
		expect(screen.getByText('Em conflito')).toBeInTheDocument()
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

	it('uses the started CTA label in empty copy', () => {
		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				hasStarted
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
				onToggle={() => undefined}
				signals={[]}
			/>,
		)

		expect(
			screen.getByText(/Coletar de novo.*para iniciar a coleta/i),
		).toBeInTheDocument()
	})

	it('moves browser-blocked signals to the end with red strikethrough', async () => {
		const user = userEvent.setup()

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

		expect(
			screen.getByRole('button', { name: /Negados: expandir/i }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /Priors regionais: expandir/i }),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: /Negados: expandir/i }))

		const blockedLabel = screen.getByText('GPS / GNSS')
		expect(blockedLabel.className).toContain('line-through')
		expect(blockedLabel.className).toContain('text-[var(--loc-danger)]')
	})

	it('styles error signals like denied', () => {
		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				selectedSignalIds={[]}
				onToggleSignal={() => undefined}
				onToggle={() => undefined}
				signals={[
					{
						id: 'ip_ipwho',
						label: 'IP (ipwho.is)',
						status: 'error',
						confidence: 0,
						summary: 'Falha ao consultar ipwho.is',
						raw: { error: 'network' },
						collectedAt: '2026-01-01T00:00:00.000Z',
					},
				]}
			/>,
		)

		const errorLabel = screen.getByText('IP (ipwho.is)')
		expect(errorLabel.className).toContain('line-through')
		expect(errorLabel.className).toContain('text-[var(--loc-danger)]')
		const card = screen.getByRole('button', { name: /IP \(ipwho\.is\)/i })
		expect(card.closest('div')?.className).toContain(
			'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)]',
		)
	})

	it('keeps multiple signal cards selected and discloses raw on demand', async () => {
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

		expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
		expect(screen.queryByText(/"kind": "gps"/)).not.toBeInTheDocument()

		const discloseButtons = screen.getAllByRole('button', {
			name: /^Evidência bruta$/i,
		})
		expect(discloseButtons).toHaveLength(2)

		const firstDisclose = discloseButtons[0]
		const secondDisclose = discloseButtons[1]
		if (firstDisclose === undefined || secondDisclose === undefined) {
			throw new Error('Expected disclose buttons')
		}

		await user.click(firstDisclose)
		await user.click(secondDisclose)

		expect(screen.getByText(/"kind": "gps"/)).toBeInTheDocument()
		expect(screen.getByText(/"kind": "network"/)).toBeInTheDocument()
	})

	it('collapses non-coordinate sections by default', async () => {
		const user = userEvent.setup()

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
						status: 'ok',
						confidence: 0.9,
						summary: 'Alta precisão',
						raw: {},
						collectedAt: '2026-01-01T00:00:00.000Z',
						lat: -23.55,
						lng: -46.63,
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

		expect(screen.getByText('GPS / GNSS')).toBeInTheDocument()
		expect(screen.queryByText('Fuso horário (IANA)')).not.toBeInTheDocument()

		await user.click(
			screen.getByRole('button', { name: /Priors regionais: expandir/i }),
		)
		expect(screen.getByText('Fuso horário (IANA)')).toBeInTheDocument()
	})

	it('copies the full scan JSON when Copiar resultados is clicked', async () => {
		const user = userEvent.setup()
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText },
		})

		renderWithProviders(
			<ForensicsPanel
				open
				isCollecting={false}
				hasStarted
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

		await user.click(
			screen.getByRole('button', { name: /^Copiar resultados$/i }),
		)
		expect(writeText).toHaveBeenCalledTimes(1)
		const firstCall = writeText.mock.calls[0]
		const payload: unknown = firstCall?.[0]
		expect(typeof payload).toBe('string')
		expect(JSON.parse(String(payload))).toMatchObject({
			fused: { agreement: 'aligned' },
			signals: [{ id: 'gps', status: 'ok' }],
		})
		expect(
			screen.getByRole('button', { name: /^Copiado$/i }),
		).toBeInTheDocument()
	})
})
