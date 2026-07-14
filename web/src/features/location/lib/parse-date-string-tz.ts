import { countriesFromTimezone } from '@features/location/lib/region-priors'

/** Well-known parenthetical labels from `Date#toString()` → soft country priors. */
const DATE_STRING_LABEL_COUNTRIES: Readonly<Record<string, readonly string[]>> =
	{
		'brasilia standard time': ['BR'],
		'brasília standard time': ['BR'],
		'horario padrao de brasilia': ['BR'],
		'horário padrão de brasília': ['BR'],
		'eastern european summer time': ['EE', 'FI', 'LV', 'LT', 'BG', 'RO', 'GR'],
		'eastern european standard time': [
			'EE',
			'FI',
			'LV',
			'LT',
			'BG',
			'RO',
			'GR',
		],
		'eastern european time': ['EE', 'FI', 'LV', 'LT'],
		'central european summer time': ['DE', 'FR', 'ES', 'IT', 'PL', 'NL'],
		'central european standard time': ['DE', 'FR', 'ES', 'IT', 'PL', 'NL'],
		'pacific daylight time': ['US', 'CA'],
		'pacific standard time': ['US', 'CA'],
		'eastern daylight time': ['US', 'CA'],
		'eastern standard time': ['US', 'CA'],
		'greenwich mean time': ['GB'],
		'british summer time': ['GB'],
		'japan standard time': ['JP'],
	}

export interface ParsedDateStringTz {
	readonly dateString: string
	readonly timeString: string
	readonly parenLabel: string | null
	readonly gmtOffsetMinutes: number | null
	readonly inferredTimezone: string | null
	readonly countryCodes: readonly string[]
}

function normalizeLabel(label: string): string {
	return label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * Parse engine `Date#toString()` / `toTimeString()` for TZ leaks that
 * `Intl` / `getTimezoneOffset` spoofs often miss.
 */
export function parseDateStringTz(
	dateString: string,
	timeString: string,
): ParsedDateStringTz {
	const parenMatch = /\(([^)]+)\)/.exec(dateString)
	const parenLabel = parenMatch?.[1]?.trim() ?? null

	const offsetMatch =
		/(?:GMT|UTC)([+-])(\d{2}):?(\d{2})/.exec(timeString) ??
		/(?:GMT|UTC)([+-])(\d{2}):?(\d{2})/.exec(dateString)
	let gmtOffsetMinutes: number | null = null
	if (offsetMatch !== null) {
		const sign = offsetMatch[1] === '-' ? -1 : 1
		const hours = Number(offsetMatch[2])
		const minutes = Number(offsetMatch[3])
		if (Number.isFinite(hours) && Number.isFinite(minutes)) {
			gmtOffsetMinutes = sign * (hours * 60 + minutes)
		}
	}

	const countryCodes = new Set<string>()
	let inferredTimezone: string | null = null

	if (parenLabel !== null) {
		const fromLabel = DATE_STRING_LABEL_COUNTRIES[normalizeLabel(parenLabel)]
		if (fromLabel !== undefined) {
			for (const code of fromLabel) {
				countryCodes.add(code)
			}
		}

		// Some engines put an IANA id in the paren (rare but useful).
		if (parenLabel.includes('/')) {
			inferredTimezone = parenLabel
			for (const code of countriesFromTimezone(parenLabel)) {
				countryCodes.add(code)
			}
		}
	}

	return {
		dateString,
		timeString,
		parenLabel,
		gmtOffsetMinutes,
		inferredTimezone,
		countryCodes: [...countryCodes],
	}
}
