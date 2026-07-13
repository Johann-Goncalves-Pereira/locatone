import { useAtomSet, useAtomValue } from '@effect-atom/atom-react'

import { useLocationScanQuery } from '@features/location/api/location.queries'
import type {
	FusedLocation,
	LocationSignal,
	PanelState,
	ProbeId,
} from '@features/location/api/location.schema'
import {
	scanRunIdAtom,
	selectedSignalIdsAtom,
} from '@features/location/atoms/location-ui.atom'
import { fuseSignals } from '@features/location/lib/fuse-signals'

export function useLocationForensics(panel: PanelState) {
	const runId = useAtomValue(scanRunIdAtom)
	const setRunId = useAtomSet(scanRunIdAtom)
	const selectedSignalIds = useAtomValue(selectedSignalIdsAtom)
	const setSelectedSignalIds = useAtomSet(selectedSignalIdsAtom)

	const query = useLocationScanQuery(runId)
	const signals: readonly LocationSignal[] = query.data ?? []
	const fused: FusedLocation | undefined =
		signals.length > 0 ? fuseSignals(signals) : undefined

	function revealOrigin() {
		setSelectedSignalIds([])
		setRunId(runId + 1)
	}

	function toggleSignal(id: ProbeId) {
		if (selectedSignalIds.includes(id)) {
			setSelectedSignalIds(selectedSignalIds.filter(item => item !== id))
			return
		}
		setSelectedSignalIds([...selectedSignalIds, id])
	}

	return {
		panel,
		runId,
		hasStarted: runId > 0,
		isCollecting: query.isFetching,
		isError: query.isError,
		errorMessage:
			query.error instanceof Error
				? query.error.message
				: query.isError
					? 'Falha ao coletar sinais.'
					: undefined,
		signals,
		fused,
		selectedSignalIds,
		revealOrigin,
		toggleSignal,
	}
}
