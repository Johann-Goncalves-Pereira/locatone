/** Approximate solar elevation (degrees) at lat/lng for a UTC instant. */
export function solarElevationDegrees(
	lat: number,
	lng: number,
	date: Date,
): number {
	const rad = Math.PI / 180
	const dayOfYear = (() => {
		const start = Date.UTC(date.getUTCFullYear(), 0, 0)
		const now = Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
		)
		return (now - start) / 86_400_000
	})()

	const declination = 23.44 * Math.sin(rad * ((360 / 365) * (dayOfYear - 81)))
	const hourUtc =
		date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
	const lst = (hourUtc * 15 + lng + 360) % 360
	const hourAngle = lst - 180

	const sinElev =
		Math.sin(lat * rad) * Math.sin(declination * rad) +
		Math.cos(lat * rad) *
			Math.cos(declination * rad) *
			Math.cos(hourAngle * rad)

	return Math.asin(Math.min(1, Math.max(-1, sinElev))) / rad
}

export function isCivilNight(elevationDegrees: number): boolean {
	return elevationDegrees < -6
}

export function expectedThemeFromSolar(
	elevationDegrees: number,
): 'dark' | 'light' {
	return isCivilNight(elevationDegrees) ? 'dark' : 'light'
}

export function localCivilMomentInTimezone(
	timeZone: string,
	date: Date,
): { readonly hour: number; readonly minute: number } | undefined {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hour: 'numeric',
			minute: 'numeric',
			hourCycle: 'h23',
		}).formatToParts(date)
		const hour = Number(parts.find(part => part.type === 'hour')?.value)
		const minute = Number(parts.find(part => part.type === 'minute')?.value)
		if (Number.isNaN(hour) || Number.isNaN(minute)) {
			return undefined
		}
		return { hour, minute }
	} catch {
		return undefined
	}
}

/** Fallback when centroid unknown: night if local hour outside 6–18. */
export function isLikelyNightByClock(
	timeZone: string,
	date: Date,
): boolean | undefined {
	const local = localCivilMomentInTimezone(timeZone, date)
	if (local === undefined) {
		return undefined
	}
	return local.hour < 6 || local.hour >= 18
}
