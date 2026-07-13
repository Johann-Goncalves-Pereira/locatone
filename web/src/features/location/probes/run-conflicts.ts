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
					signal.id === 'webrtc_stun') &&
				signal.status === 'ok',
		)
		.flatMap(signal => signal.regionHints?.countryCodes ?? [])

	const tzCountries = signals
		.filter(signal => signal.id === 'timezone' && signal.status === 'ok')
		.flatMap(signal => signal.regionHints?.countryCodes ?? [])

	const localeCountries = signals
		.filter(signal => signal.id === 'locale' && signal.status === 'ok')
		.flatMap(signal => signal.regionHints?.countryCodes ?? [])

	const groups = [ipCountries, tzCountries, localeCountries].filter(
		group => group.length > 0,
	)
	const intersection = intersectCountryCodes(groups)
	const conflicted = groups.length >= 2 && intersection.length === 0

	return makeSignal({
		id: 'ip_vs_tz',
		label,
		status: 'ok',
		confidence: conflicted ? 0.4 : 0.25,
		summary: conflicted
			? 'Países sugeridos por IP, fuso e idioma não se intersectam (VPN/proxy?).'
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
			conflicted,
		},
	})
}
