import type {
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { probeColor } from '@features/location/lib/probe-colors'

interface SignalCardProps {
	readonly signal: LocationSignal
	readonly selected: boolean
	readonly onSelect: (id: ProbeId) => void
}

const STATUS_LABEL: Record<LocationSignal['status'], string> = {
	ok: 'ok',
	denied: 'negado',
	unsupported: 'sem suporte',
	error: 'erro',
}

const BLOCKED_COLOR = '#F43F5E'

export function SignalCard({ signal, selected, onSelect }: SignalCardProps) {
	const confidencePct = Math.round(signal.confidence * 100)
	const blocked = signal.status === 'denied'
	const color = blocked ? BLOCKED_COLOR : probeColor(signal.id)

	return (
		<button
			type='button'
			onClick={() => {
				onSelect(signal.id)
			}}
			className={`w-full rounded-xl border px-3 py-3 text-left transition ${
				selected
					? 'bg-[var(--loc-panel-strong)]'
					: blocked
						? 'border-rose-500/40 bg-[var(--loc-panel)]'
						: 'border-[var(--loc-border)] bg-[var(--loc-panel)] hover:border-[var(--loc-accent-dim)]'
			}`}
			style={selected ? { borderColor: color } : undefined}
		>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<p
						className={`flex items-center gap-2 text-sm font-semibold ${
							blocked ? 'text-rose-500 line-through' : 'text-[var(--loc-ink)]'
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
						className={`mt-1 text-xs ${
							blocked
								? 'text-rose-400/90 line-through'
								: 'text-[var(--loc-muted)]'
						}`}
					>
						{signal.summary}
					</p>
				</div>
				<span
					className='shrink-0 rounded-md bg-[var(--loc-bg)] px-2 py-1 font-mono text-[10px] tracking-wide uppercase'
					style={{ color }}
				>
					{STATUS_LABEL[signal.status]} · {confidencePct}%
				</span>
			</div>
			{selected ? (
				<pre className='mt-3 max-h-40 overflow-auto rounded-lg bg-[var(--loc-bg)] p-2 font-mono text-[10px] leading-relaxed text-[var(--loc-muted)]'>
					{JSON.stringify(signal.raw, null, 2)}
				</pre>
			) : null}
		</button>
	)
}
