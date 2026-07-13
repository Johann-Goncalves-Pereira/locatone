import {
	fetchCloudflareTracePromise,
	fetchGeoJsPromise,
	fetchIpWhoPromise,
} from '@features/location/api/ip.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

function parseCoord(value: number | string | undefined): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value
	}
	if (typeof value === 'string' && value.length > 0) {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : undefined
	}
	return undefined
}

export async function runIpCloudflareProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'IP (Cloudflare edge)'
	try {
		const trace = await fetchCloudflareTracePromise(signal)
		const country = trace.loc
		const hasUseful =
			(country !== undefined && country.length > 0) ||
			(trace.ip !== undefined && trace.ip.length > 0)

		if (!hasUseful) {
			return makeSignal({
				id: 'ip_cloudflare',
				label,
				status: 'error',
				confidence: 0,
				summary: 'Traço Cloudflare vazio ou bloqueado (sem IP/país).',
				raw: { ...trace },
			})
		}

		return makeSignal({
			id: 'ip_cloudflare',
			label,
			status: 'ok',
			confidence: country ? 0.55 : 0.25,
			summary: country
				? `País pelo edge Cloudflare: ${country}${trace.colo ? ` (colo ${trace.colo})` : ''}.`
				: `IP Cloudflare: ${trace.ip ?? 'desconhecido'} (sem código de país).`,
			regionHints: country
				? { countryCodes: [country], countries: [country] }
				: undefined,
			raw: { ...trace },
		})
	} catch (error) {
		return makeSignal({
			id: 'ip_cloudflare',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao consultar Cloudflare.',
			raw: { error: String(error) },
		})
	}
}

export async function runIpIpwhoProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'IP (ipwho.is)'
	try {
		const data = await fetchIpWhoPromise(undefined, signal)
		if (!data.success) {
			return makeSignal({
				id: 'ip_ipwho',
				label,
				status: 'error',
				confidence: 0,
				summary: data.message ?? 'ipwho.is retornou success=false',
				raw: { ...data },
			})
		}

		const hasCoords =
			data.latitude !== undefined && data.longitude !== undefined

		return makeSignal({
			id: 'ip_ipwho',
			label,
			status: 'ok',
			confidence: hasCoords ? 0.6 : 0.45,
			...(hasCoords
				? {
						lat: data.latitude,
						lng: data.longitude,
						accuracyMeters: 80_000,
					}
				: {}),
			summary:
				[data.city, data.region, data.country]
					.filter(part => part !== undefined && part.length > 0)
					.join(', ') || 'GeoIP sem cidade',
			regionHints: {
				countryCodes: data.country_code ? [data.country_code] : [],
				countries: data.country ? [data.country] : [],
				cities: data.city ? [data.city] : [],
				regions: data.region ? [data.region] : [],
				...(data.timezone?.id !== undefined
					? { timezone: data.timezone.id }
					: {}),
			},
			raw: { ...data },
		})
	} catch (error) {
		return makeSignal({
			id: 'ip_ipwho',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Falha ao consultar ipwho.is',
			raw: { error: String(error) },
		})
	}
}

export async function runIpGeoJsProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'IP (geojs.io)'
	try {
		const data = await fetchGeoJsPromise(signal)
		const latitude = parseCoord(data.latitude)
		const longitude = parseCoord(data.longitude)
		const hasCoords = latitude !== undefined && longitude !== undefined
		const hasCountry =
			data.country_code !== undefined && data.country_code.length > 0

		if (!hasCoords && !hasCountry && data.ip === undefined) {
			return makeSignal({
				id: 'ip_geojs',
				label,
				status: 'error',
				confidence: 0,
				summary: 'geojs.io retornou payload vazio.',
				raw: { ...data },
			})
		}

		return makeSignal({
			id: 'ip_geojs',
			label,
			status: 'ok',
			confidence: hasCoords ? 0.58 : hasCountry ? 0.48 : 0.25,
			...(hasCoords
				? {
						lat: latitude,
						lng: longitude,
						accuracyMeters: 85_000,
					}
				: {}),
			summary:
				[data.city, data.region, data.country]
					.filter(part => part !== undefined && part.length > 0)
					.join(', ') ||
				(data.ip !== undefined ? `IP geojs: ${data.ip}` : 'GeoIP geojs'),
			regionHints: {
				countryCodes: data.country_code ? [data.country_code] : [],
				countries: data.country ? [data.country] : [],
				cities: data.city ? [data.city] : [],
				regions: data.region ? [data.region] : [],
				...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
			},
			raw: { ...data },
		})
	} catch (error) {
		return makeSignal({
			id: 'ip_geojs',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Falha ao consultar geojs.io',
			raw: { error: String(error) },
		})
	}
}
