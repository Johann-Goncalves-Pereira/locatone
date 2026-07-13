import { Button } from '@components/ui/Button'

interface LocationHeroProps {
	readonly hasStarted: boolean
	readonly isCollecting: boolean
	readonly onReveal: () => void
	readonly fusedSummary?: string | undefined
}

export function LocationHero({
	hasStarted,
	isCollecting,
	onReveal,
	fusedSummary,
}: LocationHeroProps) {
	return (
		<header className='pointer-events-none absolute inset-x-0 top-0 z-[500] p-5 md:p-8'>
			<div className='pointer-events-auto max-w-xl'>
				<p className='font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-[var(--loc-ink)] md:text-6xl'>
					Locatone
				</p>
				<p className='mt-2 max-w-md text-sm text-[var(--loc-muted)] md:text-base'>
					De onde você veio — segundo o GPS, a rede, o IP, o fuso e outros
					sinais estranhos do navegador.
				</p>
				<div className='mt-5 flex flex-wrap items-center gap-3'>
					<Button
						type='button'
						onClick={onReveal}
						disabled={isCollecting}
						className='bg-[var(--loc-accent)] text-[var(--loc-bg)] hover:bg-[var(--loc-accent-strong)] dark:bg-[var(--loc-accent)] dark:text-[var(--loc-bg)] dark:hover:bg-[var(--loc-accent-strong)]'
					>
						{isCollecting
							? 'Coletando sinais…'
							: hasStarted
								? 'Coletar de novo'
								: 'Revelar origem'}
					</Button>
					{fusedSummary ? (
						<p className='text-xs text-[var(--loc-muted)] md:text-sm'>
							{fusedSummary}
						</p>
					) : null}
				</div>
			</div>
		</header>
	)
}
