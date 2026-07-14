import type {
	FusedLocation,
	LocationSignal,
} from '@features/location/api/location.schema'

export function buildScanExportPayload(input: {
	readonly signals: readonly LocationSignal[]
	readonly fused?: FusedLocation | undefined
	readonly url?: string | undefined
	readonly userAgent?: string | undefined
	readonly collectedAt?: string | undefined
}): string {
	const payload = {
		url: input.url ?? (typeof location !== 'undefined' ? location.href : ''),
		userAgent:
			input.userAgent ??
			(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
		collectedAt: input.collectedAt ?? new Date().toISOString(),
		fused: input.fused ?? null,
		signals: input.signals.map(signal => ({
			id: signal.id,
			label: signal.label,
			status: signal.status,
			confidence: signal.confidence,
			summary: signal.summary,
			regionHints: signal.regionHints ?? null,
			lat: signal.lat ?? null,
			lng: signal.lng ?? null,
			accuracyMeters: signal.accuracyMeters ?? null,
			collectedAt: signal.collectedAt,
			raw: signal.raw,
		})),
	}
	return JSON.stringify(payload, null, 2)
}
