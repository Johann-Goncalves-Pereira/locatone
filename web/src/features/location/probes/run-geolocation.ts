import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

function isGeolocationPositionError(
	error: unknown,
): error is GeolocationPositionError {
	return (
		typeof error === 'object' &&
		error !== null &&
		typeof Reflect.get(error, 'code') === 'number' &&
		typeof Reflect.get(error, 'message') === 'string'
	)
}

function geolocationErrorStatus(code: number): LocationSignal['status'] {
	if (code === 1) {
		return 'denied'
	}
	return 'error'
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('Geolocation unsupported'))
			return
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, options)
	})
}

function pickBetterPosition(
	first: GeolocationPosition,
	second: GeolocationPosition | undefined,
): { readonly position: GeolocationPosition; readonly sampleCount: number } {
	if (second === undefined) {
		return { position: first, sampleCount: 1 }
	}
	if (second.coords.accuracy < first.coords.accuracy) {
		return { position: second, sampleCount: 2 }
	}
	return { position: first, sampleCount: 2 }
}

export async function runGpsProbe(): Promise<LocationSignal> {
	const label = 'GPS / GNSS'
	try {
		const first = await getPosition({
			enableHighAccuracy: true,
			timeout: 12_000,
			maximumAge: 0,
		})

		let second: GeolocationPosition | undefined
		try {
			second = await getPosition({
				enableHighAccuracy: true,
				timeout: 5_000,
				maximumAge: 0,
			})
		} catch {
			second = undefined
		}

		const { position, sampleCount } = pickBetterPosition(first, second)
		const { latitude, longitude, accuracy, altitude, heading, speed } =
			position.coords
		return makeSignal({
			id: 'gps',
			label,
			status: 'ok',
			confidence: Math.max(0.55, Math.min(0.98, 1 - accuracy / 5000)),
			lat: latitude,
			lng: longitude,
			accuracyMeters: accuracy,
			summary: `Coordenadas de alta precisão (±${Math.round(accuracy)} m; ${String(sampleCount)} amostra${sampleCount > 1 ? 's' : ''}).`,
			raw: {
				latitude,
				longitude,
				accuracy,
				altitude,
				heading,
				speed,
				timestamp: position.timestamp,
				sampleCount,
				samples: [
					{
						accuracy: first.coords.accuracy,
						timestamp: first.timestamp,
					},
					...(second === undefined
						? []
						: [
								{
									accuracy: second.coords.accuracy,
									timestamp: second.timestamp,
								},
							]),
				],
			},
		})
	} catch (error) {
		if (isGeolocationPositionError(error)) {
			return makeSignal({
				id: 'gps',
				label,
				status: geolocationErrorStatus(error.code),
				confidence: 0,
				summary:
					error.code === 1
						? 'Permissão de localização negada.'
						: `Falha no GPS: ${error.message}`,
				raw: { code: error.code, message: error.message },
			})
		}

		if (!('geolocation' in navigator)) {
			return makeSignal({
				id: 'gps',
				label,
				status: 'unsupported',
				confidence: 0,
				summary: 'Geolocation API indisponível neste ambiente.',
				raw: { reason: 'unsupported' },
			})
		}

		return makeSignal({
			id: 'gps',
			label,
			status: 'error',
			confidence: 0,
			summary: error instanceof Error ? error.message : 'Erro desconhecido',
			raw: { error: String(error) },
		})
	}
}

export async function runNetworkGeoProbe(): Promise<LocationSignal> {
	const label = 'Wi‑Fi / celular (via navegador)'
	try {
		const position = await getPosition({
			enableHighAccuracy: false,
			timeout: 15_000,
			maximumAge: 60_000,
		})
		const { latitude, longitude, accuracy } = position.coords
		return makeSignal({
			id: 'network_geo',
			label,
			status: 'ok',
			confidence: Math.max(0.35, Math.min(0.85, 1 - accuracy / 50_000)),
			lat: latitude,
			lng: longitude,
			accuracyMeters: accuracy,
			summary: `Localização de rede do navegador (±${Math.round(accuracy)} m). Wi‑Fi e torres não são separados na Web.`,
			raw: {
				latitude,
				longitude,
				accuracy,
				note: 'Browser chooses Wi‑Fi and/or cell; not separately exposable.',
				timestamp: position.timestamp,
			},
		})
	} catch (error) {
		if (isGeolocationPositionError(error)) {
			return makeSignal({
				id: 'network_geo',
				label,
				status: geolocationErrorStatus(error.code),
				confidence: 0,
				summary:
					error.code === 1
						? 'Permissão de localização negada.'
						: `Falha na geo de rede: ${error.message}`,
				raw: { code: error.code, message: error.message },
			})
		}

		if (!('geolocation' in navigator)) {
			return makeSignal({
				id: 'network_geo',
				label,
				status: 'unsupported',
				confidence: 0,
				summary: 'Geolocation API indisponível neste ambiente.',
				raw: { reason: 'unsupported' },
			})
		}

		return makeSignal({
			id: 'network_geo',
			label,
			status: 'error',
			confidence: 0,
			summary: error instanceof Error ? error.message : 'Erro desconhecido',
			raw: { error: String(error) },
		})
	}
}
