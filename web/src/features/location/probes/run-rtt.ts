import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface RttEndpoint {
	readonly id: string
	readonly url: string
	readonly regionHint: string
	readonly countryCodes: readonly string[]
}

const ENDPOINTS: readonly RttEndpoint[] = [
	{
		id: 'cloudflare-global',
		url: 'https://www.cloudflare.com/cdn-cgi/trace',
		regionHint: 'Cloudflare anycast',
		countryCodes: [],
	},
	{
		id: 'cloudflare-dns',
		url: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
		regionHint: 'Cloudflare DNS',
		countryCodes: [],
	},
	{
		id: 'jsdelivr',
		url: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/package.json',
		regionHint: 'jsDelivr CDN',
		countryCodes: [],
	},
	{
		id: 'fastly',
		url: 'https://www.fastly.com/',
		regionHint: 'Fastly edge',
		countryCodes: [],
	},
]

async function measureRtt(
	url: string,
	signal?: AbortSignal,
): Promise<number | undefined> {
	const started = performance.now()
	const init: RequestInit = {
		method: 'GET',
		mode: 'cors',
		cache: 'no-store',
		...(signal === undefined ? {} : { signal }),
	}
	try {
		await fetch(url, init)
		return performance.now() - started
	} catch {
		try {
			const secondStart = performance.now()
			await fetch(url, {
				method: 'HEAD',
				mode: 'no-cors',
				cache: 'no-store',
				...(signal === undefined ? {} : { signal }),
			})
			return performance.now() - secondStart
		} catch {
			return undefined
		}
	}
}

export async function runRttProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'Triangulação por latência (RTT)'
	const samples = await Promise.all(
		ENDPOINTS.map(async endpoint => {
			const rttMs = await measureRtt(endpoint.url, signal)
			return { ...endpoint, rttMs }
		}),
	)

	const measured = samples.filter(sample => sample.rttMs !== undefined)

	if (measured.length === 0) {
		return makeSignal({
			id: 'rtt_probe',
			label,
			status: 'error',
			confidence: 0,
			summary: 'Nenhum endpoint respondeu para medir RTT.',
			raw: { samples },
		})
	}

	const sorted = [...measured].sort((a, b) => {
		const aRtt = a.rttMs ?? Number.POSITIVE_INFINITY
		const bRtt = b.rttMs ?? Number.POSITIVE_INFINITY
		return aRtt - bRtt
	})
	const fastest = sorted[0]

	return makeSignal({
		id: 'rtt_probe',
		label,
		status: 'ok',
		confidence: 0.12,
		summary: fastest
			? `Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms). Sinal fraco.`
			: 'Amostras RTT coletadas.',
		regionHints: {
			countryCodes: fastest ? [...fastest.countryCodes] : [],
		},
		raw: {
			samples: samples.map(sample => ({
				id: sample.id,
				url: sample.url,
				regionHint: sample.regionHint,
				rttMs: sample.rttMs === undefined ? null : Math.round(sample.rttMs),
			})),
			note: 'RTT to CDNs is a weak prior; anycast skews results.',
		},
	})
}
