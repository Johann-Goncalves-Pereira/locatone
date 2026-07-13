import { Button } from '@components/ui/Button'

interface LocationHeroProps {
	readonly hasStarted: boolean
	readonly isCollecting: boolean
	readonly isError?: boolean | undefined
	readonly errorMessage?: string | undefined
	readonly onReveal: () => void
	readonly fusedSummary?: string | undefined
}

export function LocationHero({
	hasStarted,
	isCollecting,
	isError = false,
	errorMessage,
	onReveal,
	fusedSummary,
}: LocationHeroProps) {
	return (
		<header className='pointer-events-none absolute inset-x-0 top-0 z-[500] p-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:p-8 md:pt-[max(2rem,env(safe-area-inset-top))]'>
			<div className='pointer-events-auto max-w-xl'>
				<h1 className='font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-[var(--loc-ink)] md:text-6xl'>
					Locatone
				</h1>
				<p className='mt-2 max-w-md text-sm text-[var(--loc-muted)] md:text-base'>
					De onde você veio — segundo o GPS, a rede, o IP, o fuso e outros
					sinais estranhos do navegador.
				</p>
				<div className='mt-5 flex flex-wrap items-center gap-3'>
					<Button type='button' onClick={onReveal} disabled={isCollecting}>
						{isCollecting
							? 'Coletando sinais…'
							: isError
								? 'Tentar de novo'
								: hasStarted
									? 'Coletar de novo'
									: 'Revelar origem'}
					</Button>
					{isError ? (
						<p className='text-xs text-rose-400 md:text-sm' role='alert'>
							{errorMessage ?? 'Falha ao coletar sinais.'}
						</p>
					) : fusedSummary ? (
						<p className='text-xs text-[var(--loc-muted)] md:text-sm'>
							{fusedSummary}
						</p>
					) : null}
				</div>
			</div>
		</header>
	)
}
