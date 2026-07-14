import {
	COLLECT_ERROR_MESSAGE,
	revealCtaLabel,
} from '@features/location/lib/signal-panel'

import { Button } from '@components/ui/Button'

interface LocationHeroProps {
	readonly hasStarted: boolean
	readonly isCollecting: boolean
	readonly isError?: boolean | undefined
	readonly errorMessage?: string | undefined
	readonly panelOpen: boolean
	readonly onReveal: () => void
	readonly onOpenPanel?: (() => void) | undefined
	readonly fusedSummary?: string | undefined
}

export function LocationHero({
	hasStarted,
	isCollecting,
	isError = false,
	errorMessage,
	panelOpen,
	onReveal,
	onOpenPanel,
	fusedSummary,
}: LocationHeroProps) {
	const showStatus =
		!panelOpen && (isError || (fusedSummary !== undefined && hasStarted))

	return (
		<header className='pointer-events-none absolute inset-x-0 top-0 z-[500] p-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:p-8 md:pt-[max(2rem,env(safe-area-inset-top))]'>
			<div className='pointer-events-auto max-w-xl'>
				<h1
					className={`font-display font-extrabold tracking-tight text-[var(--loc-ink)] ${
						hasStarted ? 'text-3xl md:text-5xl' : 'text-4xl md:text-6xl'
					}`}
				>
					Locatone
				</h1>
				{hasStarted ? (
					<p className='mt-1.5 hidden max-w-md text-sm text-[var(--loc-muted)] md:block'>
						Sinais do navegador fundidos no mapa.
					</p>
				) : (
					<p className='mt-2 max-w-md text-sm text-[var(--loc-muted)] md:text-base'>
						De onde você veio — segundo o GPS, a rede, o IP, o fuso e outros
						sinais estranhos do navegador.
					</p>
				)}
				<div className='mt-5 flex flex-wrap items-center gap-3'>
					<Button type='button' onClick={onReveal} disabled={isCollecting}>
						{revealCtaLabel({ isCollecting, isError, hasStarted })}
					</Button>
					{showStatus ? (
						isError ? (
							<p
								className='text-xs text-[var(--loc-danger)] md:text-sm'
								role='alert'
							>
								{errorMessage ?? COLLECT_ERROR_MESSAGE}
							</p>
						) : (
							<button
								type='button'
								onClick={onOpenPanel}
								className='max-w-sm text-left text-xs text-[var(--loc-muted)] underline-offset-2 hover:text-[var(--loc-ink)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none md:text-sm'
							>
								{fusedSummary}
								<span className='text-[var(--loc-accent)]'>
									{' '}
									· Ver evidências
								</span>
							</button>
						)
					) : null}
				</div>
			</div>
		</header>
	)
}
