/** IANA timezone prefix / exact → ISO country codes (soft priors). */
const TIMEZONE_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	'America/Sao_Paulo': ['BR'],
	'America/Fortaleza': ['BR'],
	'America/Manaus': ['BR'],
	'America/Belem': ['BR'],
	'America/Recife': ['BR'],
	'America/Cuiaba': ['BR'],
	'America/Porto_Velho': ['BR'],
	'America/Boa_Vista': ['BR'],
	'America/Rio_Branco': ['BR'],
	'America/Noronha': ['BR'],
	'America/New_York': ['US'],
	'America/Chicago': ['US'],
	'America/Denver': ['US'],
	'America/Los_Angeles': ['US'],
	'America/Phoenix': ['US'],
	'America/Anchorage': ['US'],
	'America/Toronto': ['CA'],
	'America/Vancouver': ['CA'],
	'America/Mexico_City': ['MX'],
	'America/Buenos_Aires': ['AR'],
	'America/Argentina/Buenos_Aires': ['AR'],
	'America/Santiago': ['CL'],
	'America/Bogota': ['CO'],
	'America/Lima': ['PE'],
	'Europe/London': ['GB'],
	'Europe/Paris': ['FR'],
	'Europe/Berlin': ['DE'],
	'Europe/Madrid': ['ES'],
	'Europe/Lisbon': ['PT'],
	'Europe/Rome': ['IT'],
	'Europe/Amsterdam': ['NL'],
	'Europe/Brussels': ['BE'],
	'Europe/Zurich': ['CH'],
	'Europe/Vienna': ['AT'],
	'Europe/Warsaw': ['PL'],
	'Europe/Prague': ['CZ'],
	'Europe/Stockholm': ['SE'],
	'Europe/Oslo': ['NO'],
	'Europe/Helsinki': ['FI'],
	'Europe/Dublin': ['IE'],
	'Europe/Athens': ['GR'],
	'Europe/Moscow': ['RU'],
	'Europe/Istanbul': ['TR'],
	'Asia/Tokyo': ['JP'],
	'Asia/Seoul': ['KR'],
	'Asia/Shanghai': ['CN'],
	'Asia/Hong_Kong': ['HK'],
	'Asia/Singapore': ['SG'],
	'Asia/Bangkok': ['TH'],
	'Asia/Jakarta': ['ID'],
	'Asia/Manila': ['PH'],
	'Asia/Kolkata': ['IN'],
	'Asia/Dubai': ['AE'],
	'Asia/Jerusalem': ['IL'],
	'Asia/Tehran': ['IR'],
	'Australia/Sydney': ['AU'],
	'Australia/Melbourne': ['AU'],
	'Pacific/Auckland': ['NZ'],
	'Africa/Johannesburg': ['ZA'],
	'Africa/Cairo': ['EG'],
	'Africa/Lagos': ['NG'],
}

const LOCALE_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	'pt-BR': ['BR'],
	'pt-PT': ['PT'],
	'en-US': ['US'],
	'en-GB': ['GB'],
	'en-AU': ['AU'],
	'en-CA': ['CA'],
	'es-ES': ['ES'],
	'es-MX': ['MX'],
	'es-AR': ['AR'],
	'fr-FR': ['FR'],
	'fr-CA': ['CA'],
	'de-DE': ['DE'],
	'de-AT': ['AT'],
	'de-CH': ['CH'],
	'it-IT': ['IT'],
	'nl-NL': ['NL'],
	'ja-JP': ['JP'],
	'ko-KR': ['KR'],
	'zh-CN': ['CN'],
	'zh-TW': ['TW'],
	'zh-HK': ['HK'],
	'ru-RU': ['RU'],
	'ar-SA': ['SA'],
	'ar-EG': ['EG'],
	'hi-IN': ['IN'],
	'th-TH': ['TH'],
	'tr-TR': ['TR'],
	'pl-PL': ['PL'],
	'sv-SE': ['SE'],
}

const CURRENCY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	BRL: ['BR'],
	USD: ['US'],
	CAD: ['CA'],
	MXN: ['MX'],
	EUR: ['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI', 'GR'],
	GBP: ['GB'],
	JPY: ['JP'],
	KRW: ['KR'],
	CNY: ['CN'],
	AUD: ['AU'],
	NZD: ['NZ'],
	ARS: ['AR'],
	CLP: ['CL'],
	COP: ['CO'],
	PEN: ['PE'],
	INR: ['IN'],
	AED: ['AE'],
	TRY: ['TR'],
	RUB: ['RU'],
	ZAR: ['ZA'],
	CHF: ['CH'],
	SEK: ['SE'],
	NOK: ['NO'],
	PLN: ['PL'],
	THB: ['TH'],
	IDR: ['ID'],
	PHP: ['PH'],
	SGD: ['SG'],
	HKD: ['HK'],
	TWD: ['TW'],
}

const CALENDAR_HINTS: Readonly<
	Record<
		string,
		{ readonly countries: readonly string[]; readonly note: string }
	>
> = {
	buddhist: { countries: ['TH'], note: 'Calendário budista' },
	islamic: { countries: [], note: 'Calendário islâmico' },
	islamic_civil: { countries: [], note: 'Calendário islâmico civil' },
	islamic_tbla: { countries: [], note: 'Calendário islâmico' },
	persian: { countries: ['IR'], note: 'Calendário persa' },
	japanese: { countries: ['JP'], note: 'Calendário japonês' },
	chinese: { countries: ['CN', 'TW', 'HK'], note: 'Calendário chinês' },
	hebrew: { countries: ['IL'], note: 'Calendário hebraico' },
	indian: { countries: ['IN'], note: 'Calendário indiano' },
	coptic: { countries: ['EG'], note: 'Calendário copta' },
	ethiopic: { countries: ['ET'], note: 'Calendário etíope' },
	gregory: { countries: [], note: 'Calendário gregoriano' },
	iso8601: { countries: [], note: 'Calendário ISO-8601' },
}

/** Approximate country centroids for soft fusion when only a country code is known. */
export const COUNTRY_CENTROIDS: Readonly<
	Record<string, { readonly lat: number; readonly lng: number }>
> = {
	BR: { lat: -14.2, lng: -51.9 },
	US: { lat: 39.8, lng: -98.5 },
	CA: { lat: 56.1, lng: -106.3 },
	MX: { lat: 23.6, lng: -102.5 },
	AR: { lat: -38.4, lng: -63.6 },
	CL: { lat: -35.7, lng: -71.5 },
	CO: { lat: 4.6, lng: -74.3 },
	PE: { lat: -9.2, lng: -75.0 },
	GB: { lat: 54.0, lng: -2.0 },
	FR: { lat: 46.2, lng: 2.2 },
	DE: { lat: 51.2, lng: 10.4 },
	ES: { lat: 40.5, lng: -3.7 },
	PT: { lat: 39.4, lng: -8.2 },
	IT: { lat: 41.9, lng: 12.6 },
	NL: { lat: 52.1, lng: 5.3 },
	BE: { lat: 50.5, lng: 4.5 },
	CH: { lat: 46.8, lng: 8.2 },
	AT: { lat: 47.5, lng: 14.5 },
	PL: { lat: 51.9, lng: 19.1 },
	CZ: { lat: 49.8, lng: 15.5 },
	SE: { lat: 60.1, lng: 18.6 },
	NO: { lat: 60.5, lng: 8.5 },
	FI: { lat: 61.9, lng: 25.7 },
	IE: { lat: 53.1, lng: -7.7 },
	GR: { lat: 39.1, lng: 21.8 },
	RU: { lat: 61.5, lng: 105.3 },
	TR: { lat: 39.0, lng: 35.2 },
	JP: { lat: 36.2, lng: 138.3 },
	KR: { lat: 35.9, lng: 127.8 },
	CN: { lat: 35.9, lng: 104.2 },
	HK: { lat: 22.3, lng: 114.2 },
	SG: { lat: 1.35, lng: 103.8 },
	TH: { lat: 15.9, lng: 100.9 },
	ID: { lat: -0.8, lng: 113.9 },
	PH: { lat: 12.9, lng: 121.8 },
	IN: { lat: 20.6, lng: 78.9 },
	AE: { lat: 23.4, lng: 53.8 },
	IL: { lat: 31.0, lng: 34.9 },
	IR: { lat: 32.4, lng: 53.7 },
	AU: { lat: -25.3, lng: 133.8 },
	NZ: { lat: -40.9, lng: 174.9 },
	ZA: { lat: -30.6, lng: 22.9 },
	EG: { lat: 26.8, lng: 30.8 },
	NG: { lat: 9.1, lng: 8.7 },
	ET: { lat: 9.1, lng: 40.5 },
	SA: { lat: 23.9, lng: 45.1 },
	TW: { lat: 23.7, lng: 121.0 },
}

const GEO_TLDS: Readonly<Record<string, string>> = {
	br: 'BR',
	uk: 'GB',
	us: 'US',
	de: 'DE',
	fr: 'FR',
	jp: 'JP',
	au: 'AU',
	ca: 'CA',
	in: 'IN',
	mx: 'MX',
	ar: 'AR',
	cl: 'CL',
	pt: 'PT',
	es: 'ES',
	it: 'IT',
	nl: 'NL',
	ru: 'RU',
	cn: 'CN',
	kr: 'KR',
	nz: 'NZ',
	za: 'ZA',
	pl: 'PL',
	se: 'SE',
	no: 'NO',
	fi: 'FI',
	ie: 'IE',
	ch: 'CH',
	at: 'AT',
	be: 'BE',
	tr: 'TR',
	il: 'IL',
	sg: 'SG',
	hk: 'HK',
	tw: 'TW',
	th: 'TH',
	id: 'ID',
	ph: 'PH',
}

export function countriesFromTimezone(timezone: string): readonly string[] {
	const exact = TIMEZONE_COUNTRY[timezone]
	if (exact !== undefined) {
		return exact
	}

	return []
}

export function countriesFromLocale(locale: string): readonly string[] {
	const normalized = locale.replace('_', '-')
	const exact = LOCALE_COUNTRY[normalized]
	if (exact !== undefined) {
		return exact
	}

	const base = normalized.split('-')[0]
	if (base === undefined) {
		return []
	}

	const languageHits = Object.entries(LOCALE_COUNTRY)
		.filter(([key]) => key.startsWith(`${base}-`))
		.flatMap(([, codes]) => codes)

	return [...new Set(languageHits)]
}

export function countriesFromCurrency(currency: string): readonly string[] {
	return CURRENCY_COUNTRY[currency.toUpperCase()] ?? []
}

export function calendarPrior(calendar: string): {
	readonly countries: readonly string[]
	readonly note: string
} {
	return (
		CALENDAR_HINTS[calendar] ?? {
			countries: [],
			note: `Calendário ${calendar}`,
		}
	)
}

export function countryFromTld(hostname: string): string | undefined {
	const parts = hostname.toLowerCase().split('.')
	const tld = parts[parts.length - 1]
	if (tld === undefined) {
		return undefined
	}

	if (tld === 'uk' && parts[parts.length - 2] === 'co') {
		return 'GB'
	}

	return GEO_TLDS[tld]
}

export function countryCentroid(
	countryCode: string,
): { readonly lat: number; readonly lng: number } | undefined {
	return COUNTRY_CENTROIDS[countryCode.toUpperCase()]
}

export function intersectCountryCodes(
	groups: readonly (readonly string[])[],
): readonly string[] {
	const nonEmpty = groups.filter(group => group.length > 0)
	if (nonEmpty.length === 0) {
		return []
	}

	const [first, ...rest] = nonEmpty
	if (first === undefined) {
		return []
	}

	return first.filter(code => rest.every(group => group.includes(code)))
}
