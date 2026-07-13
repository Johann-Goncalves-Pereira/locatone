import type { PanelState } from '@features/location/api/location.schema'
import { ForensicsPanel } from '@features/location/components/ForensicsPanel'
import { LocationHero } from '@features/location/components/LocationHero'
import { LocationMap } from '@features/location/components/LocationMap'
import { useLocationForensics } from '@features/location/hooks/useLocationForensics'

interface LocationExplorerProps {
	readonly panel: PanelState
	readonly onPanelChange: (panel: PanelState) => void
}

export function LocationExplorer({
	panel,
	onPanelChange,
}: LocationExplorerProps) {
	const {
		hasStarted,
		isCollecting,
		signals,
		fused,
		selectedSignalId,
		revealOrigin,
		selectSignal,
	} = useLocationForensics(panel)

	const panelOpen = panel === 'open'

	return (
		<div className='flex min-h-dvh w-full flex-col overflow-hidden bg-[var(--loc-bg)]'>
			<div className='relative min-h-0 flex-1'>
				<div className='locatone-atmosphere pointer-events-none absolute inset-0 z-[1]' />
				<LocationMap
					fused={fused}
					signals={signals}
					selectedSignalId={selectedSignalId}
					isCollecting={isCollecting}
					panelOpen={panelOpen}
					onSelectSignal={selectSignal}
				/>
				<LocationHero
					hasStarted={hasStarted}
					isCollecting={isCollecting}
					onReveal={revealOrigin}
					fusedSummary={fused?.summary}
				/>
			</div>
			<ForensicsPanel
				open={panelOpen}
				isCollecting={isCollecting}
				signals={signals}
				fused={fused}
				selectedSignalId={selectedSignalId}
				onSelectSignal={selectSignal}
				onToggle={() => {
					onPanelChange(panelOpen ? 'closed' : 'open')
				}}
			/>
		</div>
	)
}
