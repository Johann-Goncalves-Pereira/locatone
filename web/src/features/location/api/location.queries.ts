import { queryOptions, useQuery } from '@tanstack/react-query'

import { locationKeys } from '@features/location/api/location.query-keys'
import type { LocationSignal } from '@features/location/api/location.schema'
import { runAllProbes } from '@features/location/probes/run-all-probes'

export function locationScanQueryOptions(runId: number) {
	return queryOptions({
		queryKey: locationKeys.scan(runId),
		queryFn: ({ signal }): Promise<readonly LocationSignal[]> =>
			runAllProbes(signal),
		enabled: runId > 0,
		staleTime: Infinity,
		gcTime: 1000 * 60 * 30,
		retry: false,
	})
}

export function useLocationScanQuery(runId: number) {
	return useQuery(locationScanQueryOptions(runId))
}
