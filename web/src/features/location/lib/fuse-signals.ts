import type {
	Agreement,
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import {
	countryCentroid,
	intersectCountryCodes,
} from '@features/location/lib/region-priors'

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

function collectCountryCodes(
	signals: readonly LocationSignal[],
): readonly (readonly string[])[] {
	return signals
		.filter(signal => signal.status === 'ok')
		.map(signal => signal.regionHints?.countryCodes ?? [])
		.filter(codes => codes.length > 0)
}

export function fuseSignals(signals: readonly LocationSignal[]): FusedLocation {
	const conflictMeta = signals.find(signal => signal.id === 'ip_vs_tz')
	const workerBrLeak =
		conflictMeta?.status === 'ok' &&
		typeof conflictMeta.raw === 'object' &&
		conflictMeta.raw !== null &&
		Reflect.get(conflictMeta.raw, 'workerBrLeak') === true

	// OS Worker timezone beats spoofed GPS / VPN IP city when BR leaks.
	if (workerBrLeak) {
		const centroid = countryCentroid('BR')
		if (centroid !== undefined) {
			return {
				lat: centroid.lat,
				lng: centroid.lng,
				accuracyMeters: 450_000,
				agreement: 'conflicted',
				summary:
					'GPS/VPN spoofados detectados: Worker/OS com America/Sao_Paulo → prioridade BR.',
				confidence: 0.5,
				sourceIds: signals.filter(s => s.status === 'ok').map(s => s.id),
			}
		}
	}

	const withCoords = signals.filter(signal => {
		if (
			signal.status !== 'ok' ||
			signal.lat === undefined ||
			signal.lng === undefined
		) {
			return false
		}
		// Soft RTT lateration only when confidence is meaningful but still weak.
		if (signal.id === 'rtt_probe' && signal.confidence < 0.12) {
			return false
		}
		return true
	})

	if (withCoords.length > 0) {
		let weightSum = 0
		let latAcc = 0
		let lngAcc = 0
		let accuracyAcc = 0
		const sourceIds: ProbeId[] = []

		for (const signal of withCoords) {
			const lat = signal.lat
			const lng = signal.lng
			if (lat === undefined || lng === undefined) {
				continue
			}

			const accuracy = Math.max(signal.accuracyMeters ?? 50_000, 1)
			const weight = signal.confidence / accuracy
			weightSum += weight
			latAcc += lat * weight
			lngAcc += lng * weight
			accuracyAcc += accuracy * weight
			sourceIds.push(signal.id)
		}

		if (weightSum > 0) {
			const lat = latAcc / weightSum
			const lng = lngAcc / weightSum
			const accuracyMeters = accuracyAcc / weightSum

			let maxDistanceKm = 0
			for (const signal of withCoords) {
				const sLat = signal.lat
				const sLng = signal.lng
				if (sLat === undefined || sLng === undefined) {
					continue
				}
				maxDistanceKm = Math.max(
					maxDistanceKm,
					haversineKm(lat, lng, sLat, sLng),
				)
			}

			const countryGroups = collectCountryCodes(signals)
			const intersection = intersectCountryCodes(countryGroups)
			const hasConflict =
				countryGroups.length >= 2 &&
				intersection.length === 0 &&
				countryGroups.some(
					(group, index) =>
						index > 0 &&
						group.some(code => !(countryGroups[0]?.includes(code) ?? false)),
				)

			const spreadConflict = maxDistanceKm > 150
			const agreement: Agreement =
				hasConflict || spreadConflict ? 'conflicted' : 'aligned'

			const confidence = Math.min(
				1,
				withCoords.reduce((sum, s) => sum + s.confidence, 0) /
					withCoords.length,
			)

			const summary =
				agreement === 'conflicted'
					? spreadConflict && hasConflict
						? `Conflito: fontes a até ~${Math.round(maxDistanceKm)} km e países sem interseção (VPN, proxy ou viagem recente?).`
						: spreadConflict
							? `Conflito espacial: fontes com coordenadas distam até ~${Math.round(maxDistanceKm)} km (VPN, proxy ou deslocamento recente?).`
							: 'Conflito de países: grupos de códigos sugeridos não se intersectam (VPN/proxy?).'
					: `Posição fundida a partir de ${String(sourceIds.length)} sinal(is) com coordenadas.`

			return {
				lat,
				lng,
				accuracyMeters,
				agreement,
				summary,
				confidence,
				sourceIds,
			}
		}
	}

	const countryGroups = collectCountryCodes(signals)
	const intersection = intersectCountryCodes(countryGroups)
	const union = [...new Set(countryGroups.flat())]

	if (intersection.length === 1) {
		const code = intersection[0]
		if (code !== undefined) {
			const centroid = countryCentroid(code)
			if (centroid !== undefined) {
				return {
					lat: centroid.lat,
					lng: centroid.lng,
					accuracyMeters: 400_000,
					agreement: 'sparse',
					summary: `Sem GPS; estimativa regional pelo consenso de países (${code}).`,
					confidence: 0.25,
					sourceIds: signals.filter(s => s.status === 'ok').map(s => s.id),
				}
			}
		}
	}

	if (union.length === 1) {
		const code = union[0]
		if (code !== undefined) {
			const centroid = countryCentroid(code)
			if (centroid !== undefined) {
				return {
					lat: centroid.lat,
					lng: centroid.lng,
					accuracyMeters: 500_000,
					agreement: 'sparse',
					summary: `Estimativa fraca pelo único país sugerido (${code}).`,
					confidence: 0.15,
					sourceIds: signals.filter(s => s.status === 'ok').map(s => s.id),
				}
			}
		}
	}

	const conflicted =
		countryGroups.length >= 2 &&
		intersectCountryCodes(countryGroups).length === 0

	return {
		agreement: conflicted ? 'conflicted' : 'sparse',
		summary: conflicted
			? `Sinais regionais conflitantes (${String(countryGroups.length)} grupos de país sem consenso); não foi possível fundir uma posição.`
			: 'Poucos sinais úteis; conceda localização ou verifique a rede.',
		confidence: 0,
		sourceIds: signals.filter(s => s.status === 'ok').map(s => s.id),
	}
}
