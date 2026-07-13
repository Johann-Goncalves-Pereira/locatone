import type { LocationSignal } from '@features/location/api/location.schema'
import { countryCentroid } from '@features/location/lib/region-priors'

export interface SignalMapPoint {
	readonly signal: LocationSignal
	readonly lat: number
	readonly lng: number
	readonly approximate: boolean
	readonly accuracyMeters?: number
}

function firstCentroid(
	countryCodes: readonly string[] | undefined,
): { readonly lat: number; readonly lng: number } | undefined {
	if (countryCodes === undefined) {
		return undefined
	}

	for (const code of countryCodes) {
		const centroid = countryCentroid(code)
		if (centroid !== undefined) {
			return centroid
		}
	}

	return undefined
}

export function signalMapPoints(
	signals: readonly LocationSignal[],
): readonly SignalMapPoint[] {
	const points: SignalMapPoint[] = []

	for (const signal of signals) {
		if (signal.status !== 'ok') {
			continue
		}

		if (signal.lat !== undefined && signal.lng !== undefined) {
			points.push({
				signal,
				lat: signal.lat,
				lng: signal.lng,
				approximate: false,
				...(signal.accuracyMeters !== undefined
					? { accuracyMeters: signal.accuracyMeters }
					: {}),
			})
			continue
		}

		const centroid = firstCentroid(signal.regionHints?.countryCodes)
		if (centroid === undefined) {
			continue
		}

		points.push({
			signal,
			lat: centroid.lat,
			lng: centroid.lng,
			approximate: true,
			accuracyMeters: 400_000,
		})
	}

	return points
}
