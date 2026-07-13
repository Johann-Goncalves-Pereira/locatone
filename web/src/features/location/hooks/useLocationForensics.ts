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
	selectedSignalIdAtom,
} from '@features/location/atoms/location-ui.atom'
import { fuseSignals } from '@features/location/lib/fuse-signals'

export function useLocationForensics(panel: PanelState) {
	const runId = useAtomValue(scanRunIdAtom)
	const setRunId = useAtomSet(scanRunIdAtom)
	const selectedSignalId = useAtomValue(selectedSignalIdAtom)
	const setSelectedSignalId = useAtomSet(selectedSignalIdAtom)

	const query = useLocationScanQuery(runId)
	const signals: readonly LocationSignal[] = query.data ?? []
	const fused: FusedLocation | undefined =
		signals.length > 0 ? fuseSignals(signals) : undefined

	function revealOrigin() {
		setSelectedSignalId(null)
		setRunId(runId + 1)
	}

	function selectSignal(id: ProbeId | null) {
		setSelectedSignalId(id)
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
		selectedSignalId,
		revealOrigin,
		selectSignal,
	}
}
