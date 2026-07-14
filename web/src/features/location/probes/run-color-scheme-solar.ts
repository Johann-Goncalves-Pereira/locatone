import type { LocationSignal } from '@features/location/api/location.schema'
import { countryCentroid } from '@features/location/lib/region-priors'
import {
	expectedThemeFromSolar,
	isLikelyNightByClock,
	solarElevationDegrees,
} from '@features/location/lib/solar-elevation'
import { makeSignal } from '@features/location/probes/signal-helpers'

export function runColorSchemeSolarProbe(input: {
	readonly timeZone: string
	readonly countryCodes: readonly string[]
}): LocationSignal {
	const label = 'Tema vs dia solar'
	const now = new Date()
	const prefersDark =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: dark)').matches
	const actualTheme = prefersDark ? 'dark' : 'light'

	const centroidCode = input.countryCodes[0]
	const centroid =
		centroidCode !== undefined ? countryCentroid(centroidCode) : undefined

	let expectedTheme: 'dark' | 'light' | undefined
	let elevation: number | undefined
	let method: 'solar' | 'clock' | 'none' = 'none'

	if (centroid !== undefined) {
		elevation = solarElevationDegrees(centroid.lat, centroid.lng, now)
		expectedTheme = expectedThemeFromSolar(elevation)
		method = 'solar'
	} else {
		const night = isLikelyNightByClock(input.timeZone, now)
		if (night !== undefined) {
			expectedTheme = night ? 'dark' : 'light'
			method = 'clock'
		}
	}

	const mismatch =
		expectedTheme !== undefined ? expectedTheme !== actualTheme : undefined

	return makeSignal({
		id: 'color_scheme_solar',
		label,
		status: 'ok',
		confidence: mismatch === true ? 0.28 : mismatch === false ? 0.22 : 0.12,
		summary:
			mismatch === true
				? `Tema ${actualTheme} diverge do esperado ${expectedTheme} em ${input.timeZone} (auto-tema/VPN?). Limitação: usuário pode forçar o tema.`
				: mismatch === false
					? `Tema ${actualTheme} alinha com dia/noite esperado (${method}).`
					: `Tema do SO: ${actualTheme}. Sem âncora solar suficiente.`,
		regionHints: {
			timezone: input.timeZone,
			countryCodes: [...input.countryCodes],
		},
		raw: {
			prefersDark,
			actualTheme,
			expectedTheme: expectedTheme ?? null,
			solarElevationDegrees: elevation ?? null,
			method,
			mismatch: mismatch ?? null,
			centroidCountry: centroidCode ?? null,
			note: 'Só é forte se o SO alterna tema pelo nascer/pôr do sol; override manual gera falso conflito.',
		},
	})
}
