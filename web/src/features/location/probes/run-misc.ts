import { Schema } from 'effect'

import {
	type LocationSignal,
	StoredCoordinates,
	type StoredCoordinates as StoredCoordinatesType,
} from '@features/location/api/location.schema'
import { countryFromTld } from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

export const LAST_GPS_STORAGE_KEY = 'locatone:last-gps'

export function readStoredCoordinates(): StoredCoordinatesType | undefined {
	try {
		const raw = sessionStorage.getItem(LAST_GPS_STORAGE_KEY)
		if (raw === null) {
			return undefined
		}
		return Schema.decodeUnknownSync(StoredCoordinates)(JSON.parse(raw))
	} catch {
		return undefined
	}
}

export function writeStoredCoordinates(coords: StoredCoordinatesType): void {
	try {
		sessionStorage.setItem(LAST_GPS_STORAGE_KEY, JSON.stringify(coords))
	} catch {
		// ignore quota / private mode
	}
}

export function runReferrerTldProbe(): LocationSignal {
	const label = 'Referrer / TLD de origem'
	const referrer = document.referrer
	if (!referrer) {
		return makeSignal({
			id: 'referrer_tld',
			label,
			status: 'ok',
			confidence: 0.05,
			summary: 'Sem document.referrer (abertura direta ou omitido).',
			raw: { referrer: null },
		})
	}

	try {
		const url = new URL(referrer)
		const country = countryFromTld(url.hostname)
		return makeSignal({
			id: 'referrer_tld',
			label,
			status: 'ok',
			confidence: country ? 0.18 : 0.08,
			summary: country
				? `Referrer ${url.hostname} sugere país ${country}.`
				: `Referrer: ${url.hostname}.`,
			regionHints: country ? { countryCodes: [country] } : undefined,
			raw: { referrer, hostname: url.hostname, country: country ?? null },
		})
	} catch {
		return makeSignal({
			id: 'referrer_tld',
			label,
			status: 'error',
			confidence: 0,
			summary: 'Referrer inválido.',
			raw: { referrer },
		})
	}
}

export function runStorageEchoProbe(): LocationSignal {
	const label = 'Eco da sessão (GPS anterior)'
	const stored = readStoredCoordinates()
	if (stored === undefined) {
		return makeSignal({
			id: 'storage_echo',
			label,
			status: 'ok',
			confidence: 0.05,
			summary: 'Nenhuma coordenada salva nesta sessão ainda.',
			raw: { stored: null },
		})
	}

	const ageMs = Date.now() - Date.parse(stored.savedAt)
	const ageMinutes = Number.isFinite(ageMs) ? ageMs / 60_000 : 999
	const confidence = Math.max(0.1, Math.min(0.7, 0.7 - ageMinutes / 120))

	return makeSignal({
		id: 'storage_echo',
		label,
		status: 'ok',
		confidence,
		lat: stored.lat,
		lng: stored.lng,
		accuracyMeters: stored.accuracyMeters ?? 100,
		summary: `Último GPS da sessão (há ~${Math.round(ageMinutes)} min).`,
		raw: { ...stored, ageMinutes: Math.round(ageMinutes) },
	})
}

function readNetworkConnection():
	| {
			readonly effectiveType: string | null
			readonly type: string | null
			readonly downlink: number | null
			readonly rtt: number | null
			readonly saveData: boolean | null
	  }
	| undefined {
	const maybe: unknown = Reflect.get(navigator, 'connection')
	if (maybe === null || maybe === undefined || typeof maybe !== 'object') {
		return undefined
	}

	const effectiveType: unknown = Reflect.get(maybe, 'effectiveType')
	const type: unknown = Reflect.get(maybe, 'type')
	const downlink: unknown = Reflect.get(maybe, 'downlink')
	const rtt: unknown = Reflect.get(maybe, 'rtt')
	const saveData: unknown = Reflect.get(maybe, 'saveData')

	return {
		effectiveType: typeof effectiveType === 'string' ? effectiveType : null,
		type: typeof type === 'string' ? type : null,
		downlink: typeof downlink === 'number' ? downlink : null,
		rtt: typeof rtt === 'number' ? rtt : null,
		saveData: typeof saveData === 'boolean' ? saveData : null,
	}
}

export function runNetworkInfoProbe(): LocationSignal {
	const label = 'Tipo de conexão'
	const connection = readNetworkConnection()

	if (connection === undefined) {
		return makeSignal({
			id: 'network_info',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Network Information API indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	return makeSignal({
		id: 'network_info',
		label,
		status: 'ok',
		confidence: 0.08,
		summary: `Conexão ${connection.effectiveType ?? connection.type ?? 'desconhecida'}; contextualiza confiança da geo de rede.`,
		raw: connection,
	})
}

export async function runPermissionStateProbe(): Promise<LocationSignal> {
	const label = 'Estado da permissão de geolocalização'
	if (!('permissions' in navigator)) {
		return makeSignal({
			id: 'permission_state',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Permissions API indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	try {
		const result = await navigator.permissions.query({
			name: 'geolocation',
		})
		return makeSignal({
			id: 'permission_state',
			label,
			status: 'ok',
			confidence: 0.1,
			summary: `Permissão de geolocalização: ${result.state}.`,
			raw: { state: result.state },
		})
	} catch (error) {
		return makeSignal({
			id: 'permission_state',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao consultar permissão.',
			raw: { error: String(error) },
		})
	}
}
