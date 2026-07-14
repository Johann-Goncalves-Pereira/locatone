import type {
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { countryCentroid } from '@features/location/lib/region-priors'

/** Circles larger than this are omitted unless the probe is selected. */
export const CIRCLE_DRAW_MAX_METERS = 250_000

/** Points above this accuracy are excluded from default camera fit. */
export const CAMERA_ACCURACY_MAX_METERS = 500_000

export interface SignalMapPoint {
	readonly signal: LocationSignal
	readonly lat: number
	readonly lng: number
	readonly approximate: boolean
	readonly accuracyMeters?: number
}

export interface MapLatLng {
	readonly lat: number
	readonly lng: number
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

export function shouldDrawAccuracyCircle(
	point: SignalMapPoint,
	selected: boolean,
): boolean {
	if (point.accuracyMeters === undefined) {
		return false
	}
	if (selected) {
		return true
	}
	return point.accuracyMeters <= CIRCLE_DRAW_MAX_METERS
}

export function isPriorityCameraPoint(point: SignalMapPoint): boolean {
	if (point.approximate) {
		return false
	}
	if (point.accuracyMeters === undefined) {
		return true
	}
	return point.accuracyMeters <= CAMERA_ACCURACY_MAX_METERS
}

export function cameraFocusLatLngs(
	points: readonly SignalMapPoint[],
	fused: FusedLocation | undefined,
	selectedIds: readonly ProbeId[],
): readonly MapLatLng[] {
	const selectedPoints = points.filter(point =>
		selectedIds.includes(point.signal.id),
	)

	if (selectedPoints.length > 0) {
		return selectedPoints.map(point => ({ lat: point.lat, lng: point.lng }))
	}

	const priority: MapLatLng[] = []
	for (const point of points) {
		if (isPriorityCameraPoint(point)) {
			priority.push({ lat: point.lat, lng: point.lng })
		}
	}

	if (fused?.lat !== undefined && fused.lng !== undefined) {
		priority.push({ lat: fused.lat, lng: fused.lng })
	}

	if (priority.length > 0) {
		return priority
	}

	const fallback: MapLatLng[] = points.map(point => ({
		lat: point.lat,
		lng: point.lng,
	}))
	if (fused?.lat !== undefined && fused.lng !== undefined) {
		fallback.push({ lat: fused.lat, lng: fused.lng })
	}
	return fallback
}

export function formatAccuracyMeters(meters: number): string {
	if (meters >= 1000) {
		return `±${Math.round(meters / 1000)} km`
	}
	return `±${Math.round(meters)} m`
}
