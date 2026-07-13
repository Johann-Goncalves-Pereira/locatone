import type { LocationSignal } from '@features/location/api/location.schema'

export function nowIso(): string {
	return new Date().toISOString()
}

export function makeSignal(input: {
	readonly id: LocationSignal['id']
	readonly label: string
	readonly status: LocationSignal['status']
	readonly confidence: number
	readonly summary: string
	readonly raw: unknown
	readonly lat?: number
	readonly lng?: number
	readonly accuracyMeters?: number
	readonly regionHints?: LocationSignal['regionHints']
}): LocationSignal {
	return {
		id: input.id,
		label: input.label,
		status: input.status,
		confidence: input.confidence,
		raw: input.raw,
		collectedAt: nowIso(),
		summary: input.summary,
		...(input.lat !== undefined ? { lat: input.lat } : {}),
		...(input.lng !== undefined ? { lng: input.lng } : {}),
		...(input.accuracyMeters !== undefined
			? { accuracyMeters: input.accuracyMeters }
			: {}),
		...(input.regionHints !== undefined
			? { regionHints: input.regionHints }
			: {}),
	}
}
