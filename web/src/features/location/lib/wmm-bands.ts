/**
 * Coarse World Magnetic Model intensity bands (µT) by ISO country.
 * Total field |B| typically ~22–65 µT at Earth's surface.
 */
const COUNTRY_FIELD_UT: Readonly<
	Record<string, { readonly minUt: number; readonly maxUt: number }>
> = {
	BR: { minUt: 22, maxUt: 32 },
	AR: { minUt: 22, maxUt: 30 },
	CL: { minUt: 22, maxUt: 30 },
	UY: { minUt: 22, maxUt: 30 },
	US: { minUt: 40, maxUt: 60 },
	CA: { minUt: 48, maxUt: 62 },
	MX: { minUt: 35, maxUt: 48 },
	GB: { minUt: 45, maxUt: 52 },
	FR: { minUt: 44, maxUt: 50 },
	DE: { minUt: 46, maxUt: 52 },
	ES: { minUt: 42, maxUt: 48 },
	PT: { minUt: 42, maxUt: 48 },
	IT: { minUt: 44, maxUt: 50 },
	NL: { minUt: 46, maxUt: 52 },
	PL: { minUt: 48, maxUt: 54 },
	RU: { minUt: 50, maxUt: 62 },
	JP: { minUt: 44, maxUt: 52 },
	KR: { minUt: 44, maxUt: 52 },
	CN: { minUt: 42, maxUt: 56 },
	IN: { minUt: 38, maxUt: 48 },
	AU: { minUt: 50, maxUt: 62 },
	NZ: { minUt: 52, maxUt: 62 },
	ZA: { minUt: 25, maxUt: 35 },
	EG: { minUt: 38, maxUt: 46 },
	AE: { minUt: 38, maxUt: 46 },
	IL: { minUt: 40, maxUt: 48 },
	TR: { minUt: 42, maxUt: 50 },
	TH: { minUt: 38, maxUt: 46 },
	ID: { minUt: 38, maxUt: 48 },
	PH: { minUt: 38, maxUt: 46 },
	SG: { minUt: 38, maxUt: 46 },
	HK: { minUt: 42, maxUt: 50 },
	TW: { minUt: 42, maxUt: 50 },
}

const HEMISPHERE_BANDS = {
	northern: { minUt: 35, maxUt: 65 },
	southern: { minUt: 22, maxUt: 40 },
	equatorial: { minUt: 28, maxUt: 42 },
} as const

export function magneticFieldMagnitudeUt(
	x: number,
	y: number,
	z: number,
): number {
	return Math.sqrt(x * x + y * y + z * z)
}

export function expectedFieldBandForCountry(
	countryCode: string,
): { readonly minUt: number; readonly maxUt: number } | undefined {
	return COUNTRY_FIELD_UT[countryCode.toUpperCase()]
}

export function hemisphereFromLatitude(
	lat: number,
): keyof typeof HEMISPHERE_BANDS {
	if (lat > 15) {
		return 'northern'
	}
	if (lat < -15) {
		return 'southern'
	}
	return 'equatorial'
}

export function fieldMatchesCountryBand(
	magnitudeUt: number,
	countryCode: string,
): boolean | undefined {
	const band = expectedFieldBandForCountry(countryCode)
	if (band === undefined) {
		return undefined
	}
	return magnitudeUt >= band.minUt && magnitudeUt <= band.maxUt
}

export function fieldMatchesHemisphere(
	magnitudeUt: number,
	hemisphere: keyof typeof HEMISPHERE_BANDS,
): boolean {
	const band = HEMISPHERE_BANDS[hemisphere]
	return magnitudeUt >= band.minUt && magnitudeUt <= band.maxUt
}

export function evaluateMagneticConsistency(input: {
	readonly magnitudeUt: number
	readonly countryCodes: readonly string[]
}): {
	readonly compatibleCountries: readonly string[]
	readonly incompatibleCountries: readonly string[]
	readonly conflicted: boolean
} {
	const compatible: string[] = []
	const incompatible: string[] = []

	for (const code of input.countryCodes) {
		const match = fieldMatchesCountryBand(input.magnitudeUt, code)
		if (match === true) {
			compatible.push(code)
		} else if (match === false) {
			incompatible.push(code)
		}
	}

	const conflicted =
		incompatible.length > 0 &&
		compatible.length === 0 &&
		input.countryCodes.length > 0

	return {
		compatibleCountries: compatible,
		incompatibleCountries: incompatible,
		conflicted,
	}
}
