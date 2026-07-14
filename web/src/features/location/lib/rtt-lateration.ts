export interface RttLandmark {
	readonly id: string
	readonly lat: number
	readonly lng: number
	readonly countryCodes: readonly string[]
	readonly rttMs: number
}

/** Fiber-ish RTT → distance (km). Soft; routing/jitter dominate. */
export function rttMsToDistanceKm(rttMs: number): number {
	const oneWayMs = Math.max(rttMs, 1) / 2
	const fiberKm = (oneWayMs / 1000) * 200_000
	const routingFactor = 1.6
	return Math.min(fiberKm * routingFactor, 20_000)
}

function haversineKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180
	const dLat = toRad(lat2 - lat1)
	const dLng = toRad(lng2 - lng1)
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Landmark RTT spread below this (ms) looks like extension neutralize / local redirect. */
export const FLAT_RTT_SPREAD_MS = 10

/**
 * Ultra-flat landmark RTTs imply neutralised hosts (same local redirect target),
 * not real regional latency — skip lateration coords in that case.
 */
export function isFlatLandmarkRtt(
	landmarks: readonly Pick<RttLandmark, 'rttMs'>[],
	spreadMs: number = FLAT_RTT_SPREAD_MS,
): boolean {
	const values = landmarks
		.map(item => item.rttMs)
		.filter(rtt => rtt > 0 && Number.isFinite(rtt))
	if (values.length < 2) {
		return false
	}
	const min = Math.min(...values)
	const max = Math.max(...values)
	return max - min < spreadMs
}

/**
 * Soft multilateration: weight closest landmarks by inverse distance residual.
 * Returns undefined unless at least two landmarks with measured RTT.
 * Flat (near-identical) RTT clusters return undefined — treat as spoof evidence upstream.
 */
export function softLaterateFromRtt(landmarks: readonly RttLandmark[]):
	| {
			readonly lat: number
			readonly lng: number
			readonly accuracyMeters: number
			readonly confidence: number
	  }
	| undefined {
	const usable = landmarks
		.filter(item => item.rttMs > 0 && Number.isFinite(item.rttMs))
		.slice()
		.sort((a, b) => a.rttMs - b.rttMs)
		.slice(0, 4)

	if (usable.length < 2) {
		return undefined
	}

	if (isFlatLandmarkRtt(usable)) {
		return undefined
	}

	let weightSum = 0
	let latAcc = 0
	let lngAcc = 0
	const residuals: number[] = []

	for (const landmark of usable) {
		const expectedKm = rttMsToDistanceKm(landmark.rttMs)
		const weight = 1 / Math.max(expectedKm, 50)
		weightSum += weight
		latAcc += landmark.lat * weight
		lngAcc += landmark.lng * weight
	}

	if (weightSum <= 0) {
		return undefined
	}

	const lat = latAcc / weightSum
	const lng = lngAcc / weightSum

	for (const landmark of usable) {
		const expectedKm = rttMsToDistanceKm(landmark.rttMs)
		const actualKm = haversineKm(lat, lng, landmark.lat, landmark.lng)
		residuals.push(Math.abs(actualKm - expectedKm))
	}

	const meanResidual =
		residuals.reduce((sum, value) => sum + value, 0) / residuals.length
	const accuracyMeters = Math.min(
		Math.max(meanResidual * 1000, 500_000),
		4_000_000,
	)
	const confidence = Math.min(0.25, 0.12 + usable.length * 0.03)

	return { lat, lng, accuracyMeters, confidence }
}
