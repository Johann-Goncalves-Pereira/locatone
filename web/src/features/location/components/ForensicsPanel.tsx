import { useAtomSet, useAtomValue } from '@effect-atom/atom-react'

import type {
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { sectionOpenAtom } from '@features/location/atoms/location-ui.atom'
import { SignalCard } from '@features/location/components/SignalCard'
import { competitionVerdict } from '@features/location/lib/competition-verdict'
import { FUSED_COLOR } from '@features/location/lib/probe-colors'
import { formatAccuracyMeters } from '@features/location/lib/signal-map-points'
import {
	COLLECT_ERROR_MESSAGE,
	PANEL_GROUP_LABELS,
	type PanelGroupKey,
	agreementChipClass,
	agreementLabel,
	agreementToneClass,
	collectingPlaceholderSignals,
	groupSignalsBySection,
	revealCtaLabel,
} from '@features/location/lib/signal-panel'

interface ForensicsPanelProps {
	readonly open: boolean
	readonly isCollecting: boolean
	readonly hasStarted?: boolean | undefined
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

function sectionDomId(key: PanelGroupKey): string {
	return `locatone-section-${key}`
}

export function ForensicsPanel({
	open,
	isCollecting,
	hasStarted = false,
	isError = false,
	errorMessage,
	signals,
	fused,
	selectedSignalIds,
	onToggleSignal,
	onToggle,
	onRetry,
}: ForensicsPanelProps) {
	const openGroups = useAtomValue(sectionOpenAtom)
	const setOpenGroups = useAtomSet(sectionOpenAtom)
	const displaySignals =
		isCollecting && signals.length === 0
			? collectingPlaceholderSignals()
			: signals
	const grouped = groupSignalsBySection(displaySignals)
	const verdict =
		!isCollecting && signals.length > 0
			? competitionVerdict(signals)
			: undefined
	const panelBodyId = 'locatone-forensics-body'
	const ctaLabel = revealCtaLabel({
		isCollecting: false,
		isError: false,
		hasStarted,
	})
	const subtitle = isError
		? (errorMessage ?? COLLECT_ERROR_MESSAGE)
		: isCollecting
			? 'Varredura em andamento…'
			: fused
				? fused.summary
				: 'Cada método, com confiança e evidência bruta.'

	function toggleGroup(key: PanelGroupKey) {
		if (openGroups.includes(key)) {
			setOpenGroups(openGroups.filter(item => item !== key))
			return
		}
		setOpenGroups([...openGroups, key])
	}

	function jumpToGroup(key: PanelGroupKey) {
		if (!openGroups.includes(key)) {
			setOpenGroups([...openGroups, key])
		}
		window.requestAnimationFrame(() => {
			const node = document.getElementById(sectionDomId(key))
			node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		})
	}

	return (
		<section
			className={`locatone-panel-shell shrink-0 border-t border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_94%,transparent)] backdrop-blur-md ${
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
					<p className='font-display text-sm font-bold tracking-wide text-[var(--loc-ink)]'>
						Painel forense
					</p>
					<p
						className={`truncate text-xs ${
							isError ? 'text-[var(--loc-danger)]' : 'text-[var(--loc-muted)]'
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
					<div className='mb-4 rounded-xl border border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[var(--loc-panel)] px-3 py-3'>
						<p className='text-sm text-[var(--loc-danger)]'>
							{errorMessage ?? COLLECT_ERROR_MESSAGE}
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

				{verdict !== undefined ? (
					<div
						className={`mb-4 rounded-xl border px-3 py-3 ${
							verdict.kind === 'brazil_leak'
								? 'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[var(--loc-panel)]'
								: verdict.kind === 'aligned_spoof'
									? 'border-[color-mix(in_oklab,var(--loc-ok)_40%,transparent)] bg-[var(--loc-panel)]'
									: 'border-[var(--loc-border)] bg-[var(--loc-panel)]'
						}`}
					>
						<div className='flex flex-wrap items-center gap-2'>
							<span
								className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
									verdict.kind === 'brazil_leak'
										? 'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--loc-danger)_12%,transparent)] text-[var(--loc-danger)]'
										: verdict.kind === 'aligned_spoof'
											? 'border-[color-mix(in_oklab,var(--loc-ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--loc-ok)_12%,transparent)] text-[var(--loc-ok)]'
											: 'border-[var(--loc-border)] text-[var(--loc-muted)]'
								}`}
							>
								{verdict.label}
							</span>
							<span className='text-[10px] tracking-wider text-[var(--loc-muted)] uppercase'>
								Mandirituba × Tallinn
							</span>
						</div>
						<p className='mt-2 text-sm text-[var(--loc-ink)]'>
							{verdict.detail}
						</p>
					</div>
				) : null}

				{fused ? (
					<div
						className={`locatone-fuse-card mb-4 rounded-xl border px-3 py-3 ${
							fused.agreement === 'conflicted'
								? 'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[var(--loc-panel)]'
								: 'border-[var(--loc-accent-dim)] bg-[var(--loc-panel)]'
						}`}
					>
						<div className='flex flex-wrap items-center gap-2'>
							<span
								className='size-2.5 rounded-full'
								style={{ backgroundColor: FUSED_COLOR }}
								aria-hidden
							/>
							<span
								className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${agreementChipClass(fused.agreement)}`}
							>
								{agreementLabel(fused.agreement)}
							</span>
							<span
								className={`text-xs tracking-wider uppercase ${agreementToneClass(fused.agreement)}`}
							>
								Fusão
							</span>
							<span className='text-xs text-[var(--loc-muted)]'>
								· {String(fused.sourceIds.length)} fonte
								{fused.sourceIds.length === 1 ? '' : 's'}
							</span>
						</div>
						<p className='mt-2 text-sm text-[var(--loc-ink)]'>
							{fused.summary}
						</p>
						{fused.lat !== undefined && fused.lng !== undefined ? (
							<p className='mt-2 font-mono text-xs text-[var(--loc-muted)]'>
								{fused.lat.toFixed(5)}, {fused.lng.toFixed(5)}
								{fused.accuracyMeters !== undefined
									? ` ${formatAccuracyMeters(fused.accuracyMeters)}`
									: ''}
							</p>
						) : null}
					</div>
				) : null}

				{grouped.length === 0 ? (
					<p className='text-sm text-[var(--loc-muted)]'>
						Toque em &ldquo;{ctaLabel}&rdquo; para iniciar a coleta.
					</p>
				) : (
					<>
						{signals.length > 0 ? (
							<nav
								aria-label='Seções do painel'
								className='sticky top-0 z-10 -mx-5 mb-4 border-b border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_92%,transparent)] px-5 py-2 backdrop-blur-md'
							>
								<ul className='flex gap-2 overflow-x-auto pb-0.5'>
									{grouped.map(group => (
										<li key={`nav-${group.key}`}>
											<button
												type='button'
												onClick={() => {
													jumpToGroup(group.key)
												}}
												className='shrink-0 rounded-md border border-[var(--loc-border)] px-2.5 py-1 text-[11px] text-[var(--loc-ink)] hover:border-[var(--loc-accent-dim)] focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
											>
												{PANEL_GROUP_LABELS[group.key]}
											</button>
										</li>
									))}
								</ul>
							</nav>
						) : null}

						<div className='space-y-3'>
							{grouped.map(group => {
								const groupOpen = openGroups.includes(group.key)
								const bodyId = `${sectionDomId(group.key)}-body`
								return (
									<div
										key={group.key}
										id={sectionDomId(group.key)}
										className='scroll-mt-14'
									>
										<button
											type='button'
											aria-expanded={groupOpen}
											aria-controls={bodyId}
											aria-label={`${PANEL_GROUP_LABELS[group.key]}: ${groupOpen ? 'recolher' : 'expandir'}, ${String(group.signals.length)}`}
											onClick={() => {
												toggleGroup(group.key)
											}}
											className='mb-2 flex w-full items-center justify-between gap-2 text-left focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
										>
											<span className='text-[11px] font-semibold tracking-wider text-[color-mix(in_oklab,var(--loc-accent)_70%,var(--loc-muted))] uppercase'>
												{PANEL_GROUP_LABELS[group.key]}
											</span>
											<span className='text-[11px] text-[var(--loc-muted)]'>
												{groupOpen ? 'Recolher' : 'Expandir'} ·{' '}
												{String(group.signals.length)}
											</span>
										</button>
										{groupOpen ? (
											<ul
												id={bodyId}
												className='grid items-stretch gap-2 md:grid-cols-2'
											>
												{group.signals.map(signal => (
													<li key={signal.id} className='h-full'>
														<SignalCard
															signal={signal}
															selected={selectedSignalIds.includes(signal.id)}
															placeholder={isPlaceholderSignal(signal)}
															onToggle={onToggleSignal}
														/>
													</li>
												))}
											</ul>
										) : null}
									</div>
								)
							})}
						</div>
					</>
				)}
			</div>
		</section>
	)
}
