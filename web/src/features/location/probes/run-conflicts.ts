import type { LocationSignal } from '@features/location/api/location.schema'
import {
	countriesFromTimezone,
	intersectCountryCodes,
} from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

function expectedOffsetMinutes(
	timeZone: string,
	date: Date,
): number | undefined {
	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			timeZoneName: 'shortOffset',
		})
		const parts = formatter.formatToParts(date)
		const offsetPart = parts.find(part => part.type === 'timeZoneName')
		const value = offsetPart?.value
		if (value === undefined) {
			return undefined
		}

		if (value === 'GMT' || value === 'UTC') {
			return 0
		}

		const match = /(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?/.exec(value)
		if (match === null) {
			return undefined
		}
		const sign = match[1] === '-' ? -1 : 1
		const hours = Number(match[2])
		const minutes = Number(match[3] ?? '0')
		if (Number.isNaN(hours) || Number.isNaN(minutes)) {
			return undefined
		}
		return sign * (hours * 60 + minutes)
	} catch {
		return undefined
	}
}

function readMismatchFlag(raw: unknown): boolean {
	return readRawFlag(raw, 'mismatch') || readRawFlag(raw, 'conflicted')
}

function readRawFlag(raw: unknown, key: string): boolean {
	if (typeof raw !== 'object' || raw === null) {
		return false
	}
	return Reflect.get(raw, key) === true
}

export function runTzOffsetConflictProbe(): LocationSignal {
	const label = 'Relógio vs fuso IANA'
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const now = new Date()
	const jsOffset = -now.getTimezoneOffset()
	const expected = expectedOffsetMinutes(timeZone, now)
	const mismatch =
		expected !== undefined ? Math.abs(jsOffset - expected) > 1 : false

	return makeSignal({
		id: 'tz_offset_conflict',
		label,
		status: 'ok',
		confidence: mismatch ? 0.35 : 0.2,
		summary: mismatch
			? `Offset do Date (${String(jsOffset)} min) diverge do fuso ${timeZone} (${String(expected)} min).`
			: `Offset consistente com ${timeZone}.`,
		regionHints: {
			timezone: timeZone,
			countryCodes: [...countriesFromTimezone(timeZone)],
		},
		raw: {
			timeZone,
			jsOffsetMinutes: jsOffset,
			expectedOffsetMinutes: expected ?? null,
			mismatch,
		},
	})
}

export function runIpVsTzProbe(
	signals: readonly LocationSignal[],
): LocationSignal {
	const label = 'Conflito IP × fuso × locale'
	const ipCountries = signals
		.filter(
			signal =>
				(signal.id === 'ip_cloudflare' ||
					signal.id === 'ip_ipwho' ||
					signal.id === 'ip_geojs' ||
					signal.id === 'webrtc_stun' ||
					signal.id === 'edge_geo') &&
				signal.status === 'ok',
		)
		.flatMap(signal => signal.regionHints?.countryCodes ?? [])

	const tzCountries = [
		...signals
			.filter(signal => signal.id === 'timezone' && signal.status === 'ok')
			.flatMap(signal => signal.regionHints?.countryCodes ?? []),
		...signals
			.filter(
				signal =>
					(signal.id === 'date_string_tz' ||
						signal.id === 'worker_intl' ||
						signal.id === 'iframe_intl' ||
						signal.id === 'service_worker_intl') &&
					signal.status === 'ok',
			)
			.flatMap(signal => signal.regionHints?.countryCodes ?? []),
	]

	const localeCountries = signals
		.filter(
			signal =>
				(signal.id === 'locale' ||
					signal.id === 'accept_language' ||
					signal.id === 'speech_voices') &&
				signal.status === 'ok',
		)
		.flatMap(signal => signal.regionHints?.countryCodes ?? [])

	const groups = [ipCountries, tzCountries, localeCountries].filter(
		group => group.length > 0,
	)
	const intersection = intersectCountryCodes(groups)
	const regionConflicted = groups.length >= 2 && intersection.length === 0

	const magnetometer = signals.find(signal => signal.id === 'magnetometer')
	const solar = signals.find(signal => signal.id === 'color_scheme_solar')
	const ipSanity = signals.find(signal => signal.id === 'ip_sanity')
	const storageConflict = signals.find(
		signal => signal.id === 'storage_gps_conflict',
	)
	const magneticConflict =
		magnetometer?.status === 'ok' && readMismatchFlag(magnetometer.raw)
	const solarMismatch = solar?.status === 'ok' && readMismatchFlag(solar.raw)
	const ipSanityConflict =
		ipSanity?.status === 'ok' && readRawFlag(ipSanity.raw, 'suspicious')
	const storageGpsConflict =
		storageConflict?.status === 'ok' && readMismatchFlag(storageConflict.raw)

	const dateString = signals.find(signal => signal.id === 'date_string_tz')
	const workerIntl = signals.find(signal => signal.id === 'worker_intl')
	const iframeIntl = signals.find(signal => signal.id === 'iframe_intl')
	const serviceWorkerIntl = signals.find(
		signal => signal.id === 'service_worker_intl',
	)
	const acceptLanguage = signals.find(signal => signal.id === 'accept_language')
	const speechVoices = signals.find(signal => signal.id === 'speech_voices')

	const dateStringLeak =
		dateString?.status === 'ok' && readRawFlag(dateString.raw, 'offsetMismatch')
	const workerMismatch =
		workerIntl?.status === 'ok' && readRawFlag(workerIntl.raw, 'mismatch')
	const iframeMismatch =
		iframeIntl?.status === 'ok' && readRawFlag(iframeIntl.raw, 'mismatch')
	const serviceWorkerMismatch =
		serviceWorkerIntl?.status === 'ok' &&
		readRawFlag(serviceWorkerIntl.raw, 'mismatch')
	const acceptLanguageMismatch =
		acceptLanguage?.status === 'ok' &&
		readRawFlag(acceptLanguage.raw, 'mismatch')
	const speechBrazilLeak =
		speechVoices?.status === 'ok' && readRawFlag(speechVoices.raw, 'hasPtBr')

	const conflicted =
		regionConflicted ||
		magneticConflict ||
		solarMismatch ||
		ipSanityConflict ||
		storageGpsConflict ||
		dateStringLeak ||
		workerMismatch ||
		iframeMismatch ||
		serviceWorkerMismatch ||
		acceptLanguageMismatch ||
		speechBrazilLeak

	const extras: string[] = []
	if (magneticConflict) {
		extras.push('campo magnético×IP')
	}
	if (solarMismatch) {
		extras.push('tema×dia solar')
	}
	if (ipSanityConflict) {
		extras.push('IP documental')
	}
	if (storageGpsConflict) {
		extras.push('GPS sessão×atual')
	}
	if (dateStringLeak) {
		extras.push('Date#toString×Intl')
	}
	if (workerMismatch) {
		extras.push('Worker×página')
	}
	if (iframeMismatch) {
		extras.push('iframe×página')
	}
	if (serviceWorkerMismatch) {
		extras.push('SW×página')
	}
	if (acceptLanguageMismatch) {
		extras.push('Accept-Language×navigator')
	}
	if (speechBrazilLeak) {
		extras.push('vozes pt-BR')
	}

	return makeSignal({
		id: 'ip_vs_tz',
		label,
		status: 'ok',
		confidence: conflicted ? 0.4 : 0.25,
		summary: conflicted
			? regionConflicted
				? `Países sugeridos por IP, fuso e idioma não se intersectam${extras.length > 0 ? `; também ${extras.join(' e ')}` : ''} (VPN/proxy?).`
				: `Indicadores em conflito (${extras.join(', ')}).`
			: intersection.length > 0
				? `Consenso parcial: ${intersection.join(', ')}.`
				: 'Sinais insuficientes para cruzar origem.',
		regionHints: {
			countryCodes: intersection.length > 0 ? [...intersection] : [],
		},
		raw: {
			ipCountries: [...new Set(ipCountries)],
			tzCountries: [...new Set(tzCountries)],
			localeCountries: [...new Set(localeCountries)],
			intersection,
			regionConflicted,
			magneticConflict,
			solarMismatch,
			ipSanityConflict,
			storageGpsConflict,
			dateStringLeak,
			workerMismatch,
			iframeMismatch,
			serviceWorkerMismatch,
			acceptLanguageMismatch,
			speechBrazilLeak,
			conflicted,
		},
	})
}
