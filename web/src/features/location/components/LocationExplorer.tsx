import { useEffect, useRef } from 'react'

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
		isError,
		errorMessage,
		signals,
		fused,
		selectedSignalIds,
		revealOrigin,
		toggleSignal,
	} = useLocationForensics(panel)

	const panelOpen = panel === 'open'
	const wasCollectingRef = useRef(false)

	useEffect(() => {
		if (
			wasCollectingRef.current &&
			!isCollecting &&
			!isError &&
			signals.length > 0
		) {
			onPanelChange('open')
		}
		wasCollectingRef.current = isCollecting
	}, [isCollecting, isError, onPanelChange, signals.length])

	return (
		<div className='flex min-h-dvh w-full flex-col overflow-hidden bg-[var(--loc-bg)]'>
			<div className='relative min-h-0 flex-1'>
				<div className='locatone-atmosphere pointer-events-none absolute inset-0 z-[1]' />
				<LocationMap
					fused={fused}
					signals={signals}
					selectedSignalIds={selectedSignalIds}
					isCollecting={isCollecting}
					panelOpen={panelOpen}
					onToggleSignal={toggleSignal}
				/>
				<LocationHero
					hasStarted={hasStarted}
					isCollecting={isCollecting}
					isError={isError}
					errorMessage={errorMessage}
					panelOpen={panelOpen}
					onReveal={revealOrigin}
					onOpenPanel={() => {
						onPanelChange('open')
					}}
					fusedSummary={fused?.summary}
				/>
			</div>
			<ForensicsPanel
				open={panelOpen}
				isCollecting={isCollecting}
				hasStarted={hasStarted}
				isError={isError}
				errorMessage={errorMessage}
				signals={signals}
				fused={fused}
				selectedSignalIds={selectedSignalIds}
				onToggleSignal={toggleSignal}
				onRetry={revealOrigin}
				onToggle={() => {
					onPanelChange(panelOpen ? 'closed' : 'open')
				}}
			/>
		</div>
	)
}
