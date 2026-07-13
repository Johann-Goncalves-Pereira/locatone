import type { LocationSignal } from '@features/location/api/location.schema'
import {
	calendarPrior,
	countriesFromCurrency,
	countriesFromLocale,
	countriesFromTimezone,
} from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

const REGION_CURRENCY: Readonly<Record<string, string>> = {
	BR: 'BRL',
	US: 'USD',
	CA: 'CAD',
	MX: 'MXN',
	GB: 'GBP',
	JP: 'JPY',
	KR: 'KRW',
	CN: 'CNY',
	AU: 'AUD',
	NZ: 'NZD',
	AR: 'ARS',
	CL: 'CLP',
	CO: 'COP',
	PE: 'PEN',
	IN: 'INR',
	AE: 'AED',
	TR: 'TRY',
	RU: 'RUB',
	ZA: 'ZAR',
	CH: 'CHF',
	SE: 'SEK',
	NO: 'NOK',
	PL: 'PLN',
	TH: 'THB',
	ID: 'IDR',
	PH: 'PHP',
	SG: 'SGD',
	HK: 'HKD',
	TW: 'TWD',
	DE: 'EUR',
	FR: 'EUR',
	ES: 'EUR',
	IT: 'EUR',
	PT: 'EUR',
	NL: 'EUR',
	BE: 'EUR',
	AT: 'EUR',
	IE: 'EUR',
	FI: 'EUR',
	GR: 'EUR',
}

export function runTimezoneProbe(): LocationSignal {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
	const countries = countriesFromTimezone(timezone)
	return makeSignal({
		id: 'timezone',
		label: 'Fuso horário (IANA)',
		status: 'ok',
		confidence: countries.length > 0 ? 0.4 : 0.25,
		summary:
			countries.length > 0
				? `Fuso ${timezone} sugere ${countries.join(', ')}.`
				: `Fuso detectado: ${timezone}.`,
		regionHints: {
			timezone,
			countryCodes: [...countries],
		},
		raw: { timeZone: timezone },
	})
}

export function runLocaleProbe(): LocationSignal {
	const languages = [...navigator.languages]
	const primary = navigator.language
	const countries = [
		...new Set(
			[primary, ...languages].flatMap(locale => [
				...countriesFromLocale(locale),
			]),
		),
	]
	return makeSignal({
		id: 'locale',
		label: 'Idioma / locale do dispositivo',
		status: 'ok',
		confidence: countries.length > 0 ? 0.3 : 0.15,
		summary: `Idiomas: ${languages.join(', ') || primary}.`,
		regionHints: {
			languages,
			countryCodes: countries,
		},
		raw: { language: primary, languages },
	})
}

function inferCurrencyCode(): {
	readonly currency: string
	readonly numberingSystem: string
	readonly locale: string
	readonly region: string | undefined
} {
	const resolved = new Intl.NumberFormat(navigator.language).resolvedOptions()
	const locale = new Intl.Locale(navigator.language)
	const region = locale.maximize().region
	const currency =
		region !== undefined && REGION_CURRENCY[region] !== undefined
			? REGION_CURRENCY[region]
			: 'USD'

	return {
		currency,
		numberingSystem: resolved.numberingSystem,
		locale: resolved.locale,
		region,
	}
}

export function runIntlCurrencyProbe(): LocationSignal {
	const inferred = inferCurrencyCode()
	const countries = countriesFromCurrency(inferred.currency)

	return makeSignal({
		id: 'intl_currency',
		label: 'Moeda / sistema numérico (Intl)',
		status: 'ok',
		confidence: countries.length > 0 ? 0.28 : 0.12,
		summary: `Moeda inferida: ${inferred.currency}; numeração: ${inferred.numberingSystem}.`,
		regionHints: { countryCodes: [...countries] },
		raw: {
			currency: inferred.currency,
			numberingSystem: inferred.numberingSystem,
			locale: inferred.locale,
			region: inferred.region ?? null,
		},
	})
}

export function runIntlCalendarProbe(): LocationSignal {
	const calendar = Intl.DateTimeFormat().resolvedOptions().calendar || 'gregory'
	const prior = calendarPrior(calendar)
	return makeSignal({
		id: 'intl_calendar',
		label: 'Sistema de calendário',
		status: 'ok',
		confidence: prior.countries.length > 0 ? 0.35 : 0.1,
		summary: `${prior.note} (${calendar}).`,
		regionHints: { countryCodes: [...prior.countries] },
		raw: { calendar, note: prior.note },
	})
}
