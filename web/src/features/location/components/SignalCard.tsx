import { useState } from 'react'

import type {
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { probeColor } from '@features/location/lib/probe-colors'
import { signalBadgeLabel } from '@features/location/lib/signal-badge'

interface SignalCardProps {
	readonly signal: LocationSignal
	readonly selected: boolean
	readonly placeholder?: boolean | undefined
	readonly onToggle: (id: ProbeId) => void
}

const BLOCKED_COLOR = 'var(--loc-danger)'

export function SignalCard({
	signal,
	selected,
	placeholder = false,
	onToggle,
}: SignalCardProps) {
	const [rawOpen, setRawOpen] = useState(false)
	const [copied, setCopied] = useState(false)
	const blocked = signal.status === 'denied' || signal.status === 'error'
	const color = blocked ? BLOCKED_COLOR : probeColor(signal.id)
	const badge = placeholder ? '…' : signalBadgeLabel(signal)
	const rawJson = JSON.stringify(signal.raw, null, 2)

	async function copyRaw() {
		try {
			await navigator.clipboard.writeText(rawJson)
			setCopied(true)
			window.setTimeout(() => {
				setCopied(false)
			}, 1600)
		} catch {
			setCopied(false)
		}
	}

	return (
		<div
			className={`flex h-full flex-col rounded-xl border transition ${
				placeholder
					? 'locatone-placeholder border-[var(--loc-border)] bg-[var(--loc-panel)] opacity-70'
					: selected
						? 'bg-[var(--loc-panel-strong)]'
						: blocked
							? 'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[var(--loc-panel)]'
							: 'border-[var(--loc-border)] bg-[var(--loc-panel)] hover:border-[var(--loc-accent-dim)]'
			}`}
			style={selected && !placeholder ? { borderColor: color } : undefined}
		>
			<button
				type='button'
				disabled={placeholder}
				aria-pressed={selected}
				onClick={() => {
					onToggle(signal.id)
					if (selected) {
						setRawOpen(false)
					}
				}}
				className='w-full flex-1 rounded-xl px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loc-bg)] focus-visible:outline-none disabled:cursor-default'
			>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p
							className={`flex items-center gap-2 text-sm font-semibold ${
								blocked
									? 'text-[var(--loc-danger)] line-through'
									: 'text-[var(--loc-ink)]'
							}`}
						>
							<span
								className='size-2.5 shrink-0 rounded-full'
								style={{ backgroundColor: color }}
								aria-hidden
							/>
							{signal.label}
						</p>
						<p
							className={`mt-1 line-clamp-2 text-xs ${
								blocked
									? 'text-[color-mix(in_oklab,var(--loc-danger)_90%,transparent)] line-through'
									: 'text-[var(--loc-muted)]'
							}`}
						>
							{signal.summary}
						</p>
						{selected && !placeholder ? (
							<p className='mt-1.5 text-[10px] tracking-wide text-[var(--loc-accent)] uppercase'>
								No mapa
							</p>
						) : null}
					</div>
					<span
						className='min-w-[4.5rem] shrink-0 rounded-md bg-[var(--loc-bg)] px-2 py-1 text-center font-mono text-[10px] tracking-wide uppercase'
						style={{ color }}
					>
						{badge}
					</span>
				</div>
			</button>

			{selected && !placeholder ? (
				<div className='border-t border-[var(--loc-border)] px-3 py-2'>
					<div className='flex items-center justify-between gap-2'>
						<button
							type='button'
							aria-expanded={rawOpen}
							onClick={() => {
								setRawOpen(current => !current)
							}}
							className='text-[11px] font-medium text-[var(--loc-accent)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
						>
							{rawOpen ? 'Ocultar evidência bruta' : 'Evidência bruta'}
						</button>
						{rawOpen ? (
							<button
								type='button'
								onClick={() => {
									void copyRaw()
								}}
								className='text-[11px] font-medium text-[var(--loc-muted)] underline-offset-2 hover:text-[var(--loc-ink)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
							>
								{copied ? 'Copiado' : 'Copiar'}
							</button>
						) : null}
					</div>
					{rawOpen ? (
						<pre className='mt-2 max-h-56 overflow-y-auto overscroll-contain rounded-lg bg-[var(--loc-bg)] p-2 font-mono text-[10px] leading-relaxed text-[var(--loc-muted)]'>
							{rawJson}
						</pre>
					) : null}
				</div>
			) : null}
		</div>
	)
}
