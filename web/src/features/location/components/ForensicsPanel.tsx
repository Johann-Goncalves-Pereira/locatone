import type {
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { SignalCard } from '@features/location/components/SignalCard'
import { FUSED_COLOR } from '@features/location/lib/probe-colors'

interface ForensicsPanelProps {
	readonly open: boolean
	readonly isCollecting: boolean
	readonly signals: readonly LocationSignal[]
	readonly fused?: FusedLocation | undefined
	readonly selectedSignalId: ProbeId | null
	readonly onSelectSignal: (id: ProbeId) => void
	readonly onToggle: () => void
}

function sortSignalsForPanel(
	signals: readonly LocationSignal[],
): readonly LocationSignal[] {
	return [...signals].sort((left, right) => {
		const leftBlocked = left.status === 'denied' ? 1 : 0
		const rightBlocked = right.status === 'denied' ? 1 : 0
		return leftBlocked - rightBlocked
	})
}

export function ForensicsPanel({
	open,
	isCollecting,
	signals,
	fused,
	selectedSignalId,
	onSelectSignal,
	onToggle,
}: ForensicsPanelProps) {
	const orderedSignals = sortSignalsForPanel(signals)

	return (
		<section
			className={`shrink-0 border-t border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_94%,transparent)] backdrop-blur-md ${
				open ? 'max-h-[min(60vh,36rem)]' : 'max-h-14'
			} flex flex-col overflow-hidden transition-[max-height] duration-500 ease-out`}
		>
			<button
				type='button'
				onClick={onToggle}
				className='flex w-full shrink-0 items-center justify-between px-5 py-4 text-left'
			>
				<div>
					<p className='font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-[var(--loc-ink)]'>
						Painel forense
					</p>
					<p className='text-xs text-[var(--loc-muted)]'>
						{isCollecting
							? 'Varredura em andamento…'
							: fused
								? fused.summary
								: 'Cada método, com confiança e evidência bruta.'}
					</p>
				</div>
				<span className='text-xs text-[var(--loc-accent)]'>
					{open ? 'Recolher' : 'Expandir'}
				</span>
			</button>

			<div
				className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${open ? 'block' : 'hidden'}`}
			>
				{fused ? (
					<div className='mb-4 rounded-xl border border-[var(--loc-accent-dim)] bg-[var(--loc-panel)] px-3 py-3'>
						<p className='flex items-center gap-2 text-xs tracking-wider text-[var(--loc-accent)] uppercase'>
							<span
								className='size-2.5 rounded-full'
								style={{ backgroundColor: FUSED_COLOR }}
							/>
							Fusão · {fused.agreement}
						</p>
						<p className='mt-1 text-sm text-[var(--loc-ink)]'>
							{fused.summary}
						</p>
						{fused.lat !== undefined && fused.lng !== undefined ? (
							<p className='mt-2 font-mono text-xs text-[var(--loc-muted)]'>
								{fused.lat.toFixed(5)}, {fused.lng.toFixed(5)}
								{fused.accuracyMeters !== undefined
									? ` ±${Math.round(fused.accuracyMeters)} m`
									: ''}
							</p>
						) : null}
					</div>
				) : null}

				{orderedSignals.length === 0 ? (
					<p className='text-sm text-[var(--loc-muted)]'>
						Toque em &ldquo;Revelar origem&rdquo; para iniciar a coleta.
					</p>
				) : (
					<ul className='grid gap-2 md:grid-cols-2'>
						{orderedSignals.map(signal => (
							<li key={signal.id}>
								<SignalCard
									signal={signal}
									selected={selectedSignalId === signal.id}
									onSelect={onSelectSignal}
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	)
}
