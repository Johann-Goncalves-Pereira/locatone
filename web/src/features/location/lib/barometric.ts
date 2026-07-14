/** Standard atmosphere: pressure (hPa) → elevation meters above MSL. */
export function elevationFromPressureHpa(pressureHpa: number): number {
	if (!(pressureHpa > 0)) {
		return Number.NaN
	}
	return 44_330 * (1 - Math.pow(pressureHpa / 1013.25, 0.1903))
}

export function altitudeAgreesWithPressure(input: {
	readonly gpsAltitudeMeters: number
	readonly pressureElevationMeters: number
	readonly toleranceMeters?: number
}): boolean {
	const tolerance = input.toleranceMeters ?? 120
	return (
		Math.abs(input.gpsAltitudeMeters - input.pressureElevationMeters) <=
		tolerance
	)
}
