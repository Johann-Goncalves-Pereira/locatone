import type {
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { SignalCard } from '@features/location/components/SignalCard'
import { FUSED_COLOR } from '@features/location/lib/probe-colors'
import {
	SECTION_LABELS,
	agreementLabel,
	agreementToneClass,
	collectingPlaceholderSignals,
	groupSignalsBySection,
} from '@features/location/lib/signal-panel'

interface ForensicsPanelProps {
	readonly open: boolean
	readonly isCollecting: boolean
	readonly isError?: boolean | undefined
	readonly errorMessage?: string | undefined
	readonly signals: readonly LocationSignal[]
	readonly fused?: FusedLocation | undefined
	readonly selectedSignalIds: readonly ProbeId[]
	readonly onToggleSignal: (id: ProbeId) => void
	readonly onToggle: () => void
	readonly onRetry?: (() => void) | undefined
}

function isPlaceholderSignal(signal: LocationSignal): boolean {
	return (
		signal.raw !== null &&
		typeof signal.raw === 'object' &&
		'placeholder' in signal.raw &&
		signal.raw.placeholder === true
	)
}

export function ForensicsPanel({
	open,
	isCollecting,
	isError = false,
	errorMessage,
	signals,
	fused,
	selectedSignalIds,
	onToggleSignal,
	onToggle,
	onRetry,
}: ForensicsPanelProps) {
	const displaySignals =
		isCollecting && signals.length === 0
			? collectingPlaceholderSignals()
			: signals
	const grouped = groupSignalsBySection(displaySignals)
	const panelBodyId = 'locatone-forensics-body'
	const subtitle = isError
		? (errorMessage ?? 'Falha ao coletar sinais.')
		: isCollecting
			? 'Varredura em andamento…'
			: fused
				? fused.summary
				: 'Cada método, com confiança e evidência bruta.'

	return (
		<section
			className={`shrink-0 border-t border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_94%,transparent)] backdrop-blur-md ${
				open
					? 'max-h-[min(60vh,36rem)]'
					: 'max-h-[max(3.5rem,calc(3.5rem+env(safe-area-inset-bottom)))]'
			} flex flex-col overflow-hidden transition-[max-height] duration-500 ease-out`}
			style={{
				paddingBottom: open ? 'env(safe-area-inset-bottom)' : undefined,
			}}
		>
			<button
				type='button'
				onClick={onToggle}
				aria-expanded={open}
				aria-controls={panelBodyId}
				className='flex w-full shrink-0 items-center justify-between gap-3 px-5 py-4 text-left focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loc-bg)] focus-visible:outline-none'
			>
				<div className='min-w-0'>
					<p className='font-[family-name:var(--font-display)] text-sm font-bold tracking-wide text-[var(--loc-ink)]'>
						Painel forense
					</p>
					<p
						className={`truncate text-xs ${
							isError ? 'text-rose-400' : 'text-[var(--loc-muted)]'
						}`}
					>
						{subtitle}
					</p>
				</div>
				<span className='shrink-0 text-xs text-[var(--loc-accent)]'>
					{open ? 'Recolher' : 'Expandir'}
				</span>
			</button>

			<div
				id={panelBodyId}
				role='region'
				aria-label='Evidências forenses'
				className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${open ? 'block' : 'hidden'}`}
			>
				{isError ? (
					<div className='mb-4 rounded-xl border border-rose-500/40 bg-[var(--loc-panel)] px-3 py-3'>
						<p className='text-sm text-rose-300'>
							{errorMessage ?? 'Falha ao coletar sinais.'}
						</p>
						{onRetry !== undefined ? (
							<button
								type='button'
								onClick={onRetry}
								className='mt-2 text-xs font-medium text-[var(--loc-accent)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
							>
								Tentar de novo
							</button>
						) : null}
					</div>
				) : null}

				{fused ? (
					<div
						className={`locatone-fuse-card mb-4 rounded-xl border px-3 py-3 ${
							fused.agreement === 'conflicted'
								? 'border-rose-500/40 bg-[var(--loc-panel)]'
								: 'border-[var(--loc-accent-dim)] bg-[var(--loc-panel)]'
						}`}
					>
						<p
							className={`flex items-center gap-2 text-xs tracking-wider uppercase ${agreementToneClass(fused.agreement)}`}
						>
							<span
								className='size-2.5 rounded-full'
								style={{ backgroundColor: FUSED_COLOR }}
								aria-hidden
							/>
							Fusão · {agreementLabel(fused.agreement)}
							<span className='font-normal tracking-normal text-[var(--loc-muted)] normal-case'>
								· {String(fused.sourceIds.length)} fonte
								{fused.sourceIds.length === 1 ? '' : 's'}
							</span>
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

				{grouped.length === 0 ? (
					<p className='text-sm text-[var(--loc-muted)]'>
						Toque em &ldquo;Revelar origem&rdquo; para iniciar a coleta.
					</p>
				) : (
					<div className='space-y-4'>
						{grouped.map(group => (
							<div key={`${group.section}-${group.signals[0]?.id ?? 'empty'}`}>
								<p className='mb-2 text-[10px] font-semibold tracking-wider text-[var(--loc-muted)] uppercase'>
									{group.signals.every(signal => signal.status === 'denied')
										? 'Negados'
										: SECTION_LABELS[group.section]}
								</p>
								<ul className='grid gap-2 md:grid-cols-2'>
									{group.signals.map(signal => (
										<li key={signal.id}>
											<SignalCard
												signal={signal}
												selected={selectedSignalIds.includes(signal.id)}
												placeholder={isPlaceholderSignal(signal)}
												onToggle={onToggleSignal}
											/>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	)
}
