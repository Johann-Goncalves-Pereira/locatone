import type { LocationSignal } from '@features/location/api/location.schema'
import { runCompassProbe } from '@features/location/probes/run-compass'
import {
	runIpVsTzProbe,
	runTzOffsetConflictProbe,
} from '@features/location/probes/run-conflicts'
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
import { runKeyboardLayoutProbe } from '@features/location/probes/run-keyboard'
import {
	runNetworkInfoProbe,
	runPermissionStateProbe,
	runReferrerTldProbe,
	runStorageEchoProbe,
	writeStoredCoordinates,
} from '@features/location/probes/run-misc'
import { runRttProbe } from '@features/location/probes/run-rtt'
import { runWebRtcStunProbe } from '@features/location/probes/run-webrtc-stun'

async function settleSignal(
	promise: Promise<LocationSignal>,
): Promise<LocationSignal> {
	try {
		return await promise
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
		throw error
	}
}

export async function runAllProbes(
	signal?: AbortSignal,
): Promise<readonly LocationSignal[]> {
	const parallel = await Promise.all([
		settleSignal(runGpsProbe()),
		settleSignal(runNetworkGeoProbe()),
		settleSignal(runIpCloudflareProbe(signal)),
		settleSignal(runIpIpwhoProbe(signal)),
		settleSignal(runIpGeoJsProbe(signal)),
		Promise.resolve(runTimezoneProbe()),
		Promise.resolve(runLocaleProbe()),
		settleSignal(runWebRtcStunProbe(signal)),
		settleSignal(runRttProbe(signal)),
		Promise.resolve(runIntlCurrencyProbe()),
		Promise.resolve(runIntlCalendarProbe()),
		Promise.resolve(runFontLocaleProbe()),
		settleSignal(runKeyboardLayoutProbe()),
		settleSignal(runCompassProbe()),
		Promise.resolve(runTzOffsetConflictProbe()),
		Promise.resolve(runReferrerTldProbe()),
		Promise.resolve(runStorageEchoProbe()),
		Promise.resolve(runNetworkInfoProbe()),
		settleSignal(runPermissionStateProbe()),
	])

	const gps = parallel.find(item => item.id === 'gps')
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

	const conflict = runIpVsTzProbe(parallel)
	return [...parallel, conflict]
}
