import type { LocationSignal } from '@features/location/api/location.schema'
import { haversineKm } from '@features/location/lib/geo-distance'
import { makeSignal } from '@features/location/probes/signal-helpers'

const CONFLICT_KM = 150

/**
 * Session GPS that disagrees strongly with the live GPS fix — often a
 * pre-spoof pin still in `sessionStorage`.
 */
export function runStorageGpsConflictProbe(
	gps: LocationSignal | undefined,
	storageEcho: LocationSignal | undefined,
): LocationSignal {
	const label = 'Conflito GPS sessão × atual'

	if (
		gps?.status !== 'ok' ||
		gps.lat === undefined ||
		gps.lng === undefined ||
		storageEcho?.status !== 'ok' ||
		storageEcho.lat === undefined ||
		storageEcho.lng === undefined
	) {
		return makeSignal({
			id: 'storage_gps_conflict',
			label,
			status: 'ok',
			confidence: 0.05,
			summary: 'Sem par GPS atual + eco de sessão para cruzar.',
			raw: {
				conflicted: false,
				reason: 'insufficient',
			},
		})
	}

	const distanceKm = haversineKm(
		gps.lat,
		gps.lng,
		storageEcho.lat,
		storageEcho.lng,
	)
	const conflicted = distanceKm > CONFLICT_KM

	return makeSignal({
		id: 'storage_gps_conflict',
		label,
		status: 'ok',
		confidence: conflicted ? 0.5 : 0.15,
		...(conflicted
			? {
					lat: storageEcho.lat,
					lng: storageEcho.lng,
					accuracyMeters: storageEcho.accuracyMeters ?? 500,
				}
			: {}),
		summary: conflicted
			? `Eco da sessão a ~${Math.round(distanceKm)} km do GPS atual (possível spoof pós-sessão).`
			: `Eco da sessão alinhado ao GPS (~${Math.round(distanceKm)} km).`,
		raw: {
			conflicted,
			distanceKm: Math.round(distanceKm),
			thresholdKm: CONFLICT_KM,
			gps: { lat: gps.lat, lng: gps.lng },
			stored: { lat: storageEcho.lat, lng: storageEcho.lng },
		},
	})
}
