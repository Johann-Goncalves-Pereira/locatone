import type {
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import { PROBE_FULL_LABELS } from '@features/location/lib/signal-panel'
import { runBarometerProbe } from '@features/location/probes/run-barometer'
import { runClockSkewProbe } from '@features/location/probes/run-clock-skew'
import { runColorSchemeSolarProbe } from '@features/location/probes/run-color-scheme-solar'
import { runCompassProbe } from '@features/location/probes/run-compass'
import {
	runIpVsTzProbe,
	runTzOffsetConflictProbe,
} from '@features/location/probes/run-conflicts'
import { runDateStringTzProbe } from '@features/location/probes/run-date-string-tz'
import { runEdgeGeoProbe } from '@features/location/probes/run-edge-geo'
import { runFontLocaleProbe } from '@features/location/probes/run-fonts'
import {
	runGpsProbe,
	runNetworkGeoProbe,
} from '@features/location/probes/run-geolocation'
import {
	runIntlCalendarProbe,
	runIntlCurrencyProbe,
	runLocaleProbe,
	runTimezoneProbe,
} from '@features/location/probes/run-intl'
import {
	runIpCloudflareProbe,
	runIpGeoJsProbe,
	runIpIpwhoProbe,
} from '@features/location/probes/run-ip'
import { runIpSanityProbe } from '@features/location/probes/run-ip-sanity'
import { runKeyboardLayoutProbe } from '@features/location/probes/run-keyboard'
import { runMagnetometerProbe } from '@features/location/probes/run-magnetometer'
import {
	runNetworkInfoProbe,
	runPermissionStateProbe,
	runReferrerTldProbe,
	runStorageEchoProbe,
	writeStoredCoordinates,
} from '@features/location/probes/run-misc'
import { runOrientationLeakProbe } from '@features/location/probes/run-orientation-leak'
import { runRttProbe } from '@features/location/probes/run-rtt'
import { runStorageGpsConflictProbe } from '@features/location/probes/run-storage-conflict'
import { runWebRtcStunProbe } from '@features/location/probes/run-webrtc-stun'
import { runWorkerIntlProbe } from '@features/location/probes/run-worker-intl'
import { makeSignal } from '@features/location/probes/signal-helpers'

async function settleSignal(
	id: ProbeId,
	promise: Promise<LocationSignal>,
): Promise<LocationSignal> {
	try {
		return await promise
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
		return makeSignal({
			id,
			label: PROBE_FULL_LABELS[id],
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Erro inesperado na sonda.',
			raw: { error: String(error), settled: true },
		})
	}
}

function readGpsAltitudeMeters(
	signal: LocationSignal | undefined,
): number | undefined {
	if (signal?.status !== 'ok') {
		return undefined
	}
	const raw: unknown = signal.raw
	if (typeof raw !== 'object' || raw === null) {
		return undefined
	}
	const altitude: unknown = Reflect.get(raw, 'altitude')
	return typeof altitude === 'number' && Number.isFinite(altitude)
		? altitude
		: undefined
}

function collectIpCountryCodes(
	signals: readonly LocationSignal[],
): readonly string[] {
	return [
		...new Set(
			signals
				.filter(
					signal =>
						(signal.id === 'ip_cloudflare' ||
							signal.id === 'ip_ipwho' ||
							signal.id === 'ip_geojs' ||
							signal.id === 'webrtc_stun' ||
							signal.id === 'edge_geo') &&
						signal.status === 'ok',
				)
				.flatMap(signal => signal.regionHints?.countryCodes ?? []),
		),
	]
}

export async function runAllProbes(
	signal?: AbortSignal,
): Promise<readonly LocationSignal[]> {
	const parallel = await Promise.all([
		settleSignal('gps', runGpsProbe()),
		settleSignal('network_geo', runNetworkGeoProbe()),
		settleSignal('ip_cloudflare', runIpCloudflareProbe(signal)),
		settleSignal('ip_ipwho', runIpIpwhoProbe(signal)),
		settleSignal('ip_geojs', runIpGeoJsProbe(signal)),
		settleSignal('edge_geo', runEdgeGeoProbe(signal)),
		Promise.resolve(runTimezoneProbe()),
		Promise.resolve(runLocaleProbe()),
		settleSignal('webrtc_stun', runWebRtcStunProbe(signal)),
		settleSignal('rtt_probe', runRttProbe(signal)),
		Promise.resolve(runIntlCurrencyProbe()),
		Promise.resolve(runIntlCalendarProbe()),
		Promise.resolve(runFontLocaleProbe()),
		settleSignal('keyboard_layout', runKeyboardLayoutProbe()),
		settleSignal('compass', runCompassProbe()),
		settleSignal('orientation_leak', runOrientationLeakProbe()),
		settleSignal('clock_skew', runClockSkewProbe(signal)),
		Promise.resolve(runDateStringTzProbe()),
		settleSignal('worker_intl', runWorkerIntlProbe()),
		Promise.resolve(runTzOffsetConflictProbe()),
		Promise.resolve(runReferrerTldProbe()),
		Promise.resolve(runStorageEchoProbe()),
		Promise.resolve(runNetworkInfoProbe()),
		settleSignal('permission_state', runPermissionStateProbe()),
	])

	const gps = parallel.find(item => item.id === 'gps')
	const storageEcho = parallel.find(item => item.id === 'storage_echo')

	if (gps?.status === 'ok' && gps.lat !== undefined && gps.lng !== undefined) {
		writeStoredCoordinates({
			lat: gps.lat,
			lng: gps.lng,
			...(gps.accuracyMeters !== undefined
				? { accuracyMeters: gps.accuracyMeters }
				: {}),
			savedAt: gps.collectedAt,
		})
	}

	const timezone =
		parallel.find(item => item.id === 'timezone')?.regionHints?.timezone ??
		Intl.DateTimeFormat().resolvedOptions().timeZone
	const ipCountries = collectIpCountryCodes(parallel)
	const tzCountries =
		parallel.find(item => item.id === 'timezone')?.regionHints?.countryCodes ??
		[]
	const solarCountries = ipCountries.length > 0 ? ipCountries : [...tzCountries]

	const dependent = await Promise.all([
		settleSignal('magnetometer', runMagnetometerProbe(ipCountries)),
		settleSignal('barometer', runBarometerProbe(readGpsAltitudeMeters(gps))),
		Promise.resolve(
			runColorSchemeSolarProbe({
				timeZone: timezone,
				countryCodes: solarCountries,
			}),
		),
		Promise.resolve(runStorageGpsConflictProbe(gps, storageEcho)),
	])

	const withDependent = [...parallel, ...dependent]
	const ipSanity = runIpSanityProbe(withDependent)
	const combined = [...withDependent, ipSanity]
	const conflict = runIpVsTzProbe(combined)
	return [...combined, conflict]
}
