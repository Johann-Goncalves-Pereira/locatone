import type { LocationSignal } from '@features/location/api/location.schema'
import { parseDateStringTz } from '@features/location/lib/parse-date-string-tz'
import { makeSignal } from '@features/location/probes/signal-helpers'

export function runDateStringTzProbe(): LocationSignal {
	const label = 'Date#toString / fuso do motor'
	const now = new Date()
	const dateString = now.toString()
	const timeString = now.toTimeString()
	const parsed = parseDateStringTz(dateString, timeString)
	const intlZone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const intlOffset = -now.getTimezoneOffset()
	const offsetMismatch =
		parsed.gmtOffsetMinutes !== null &&
		Math.abs(parsed.gmtOffsetMinutes - intlOffset) > 1

	const confidence =
		parsed.countryCodes.length > 0
			? offsetMismatch
				? 0.55
				: 0.35
			: offsetMismatch
				? 0.4
				: 0.15

	const summaryParts: string[] = []
	if (parsed.parenLabel !== null) {
		summaryParts.push(`Rótulo do motor: ${parsed.parenLabel}`)
	}
	if (parsed.gmtOffsetMinutes !== null) {
		summaryParts.push(`GMT ${String(parsed.gmtOffsetMinutes)} min`)
	}
	if (offsetMismatch) {
		summaryParts.push(
			`diverge do Intl (${intlZone}, ${String(intlOffset)} min)`,
		)
	}

	return makeSignal({
		id: 'date_string_tz',
		label,
		status: 'ok',
		confidence,
		summary:
			summaryParts.length > 0
				? `${summaryParts.join('; ')}.`
				: `Date#toString sem rótulo regional útil (${intlZone}).`,
		regionHints: {
			countryCodes: [...parsed.countryCodes],
			...(parsed.inferredTimezone !== null
				? { timezone: parsed.inferredTimezone }
				: {}),
		},
		raw: {
			...parsed,
			intlZone,
			intlOffsetMinutes: intlOffset,
			offsetMismatch,
		},
	})
}
