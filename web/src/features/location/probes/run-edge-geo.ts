import { fetchEdgeGeoPromise } from '@features/location/api/edge-geo.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

export async function runEdgeGeoProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'Edge geo (Vercel / servidor)'
	try {
		const data = await fetchEdgeGeoPromise(signal)

		if (!data.available) {
			return makeSignal({
				id: 'edge_geo',
				label,
				status: 'unsupported',
				confidence: 0,
				summary:
					data.reason === 'missing_endpoint'
						? 'Endpoint /api/edge-geo ausente (dev local sem Vercel).'
						: 'Geo de borda indisponível neste host.',
				raw: { ...data },
			})
		}

		const hasCoords =
			data.latitude !== undefined && data.longitude !== undefined
		const country = data.country

		return makeSignal({
			id: 'edge_geo',
			label,
			status: 'ok',
			confidence: hasCoords ? 0.75 : country ? 0.7 : 0.3,
			...(hasCoords
				? {
						lat: data.latitude,
						lng: data.longitude,
						accuracyMeters: 50_000,
					}
				: {}),
			summary: country
				? `IP visto pelo edge: ${country}${data.city ? ` (${data.city})` : ''}${data.ip ? ` · ${data.ip}` : ''}.`
				: `IP de edge sem país${data.ip ? `: ${data.ip}` : ''}.`,
			regionHints: {
				countryCodes: country ? [country] : [],
				countries: country ? [country] : [],
				cities: data.city ? [data.city] : [],
				regions: data.region ? [data.region] : [],
			},
			raw: { ...data },
		})
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
		return makeSignal({
			id: 'edge_geo',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Falha ao consultar edge geo.',
			raw: { error: String(error) },
		})
	}
}
