import type { LocationSignal } from '@features/location/api/location.schema'
import {
	isFlatLandmarkRtt,
	softLaterateFromRtt,
} from '@features/location/lib/rtt-lateration'
import { makeSignal } from '@features/location/probes/signal-helpers'

/** Shown in flat-RTT summary (matches FLAT_RTT_SPREAD_MS). */
const FLAT_HINT_MS = 10

interface RttEndpoint {
	readonly id: string
	readonly url: string
	readonly regionHint: string
	readonly countryCodes: readonly string[]
	readonly lat: number | undefined
	readonly lng: number | undefined
	readonly isLandmark: boolean
}

/** Region-labeled hosts (soft priors). Anycast CDNs may still skew RTT. */
const ENDPOINTS: readonly RttEndpoint[] = [
	{
		id: 'gov-br',
		url: 'https://www.gov.br/favicon.ico',
		regionHint: 'Brasil (gov.br)',
		countryCodes: ['BR'],
		lat: -15.78,
		lng: -47.93,
		isLandmark: true,
	},
	{
		id: 'bcb-br',
		url: 'https://www.bcb.gov.br/favicon.ico',
		regionHint: 'Brasil (bcb.gov.br)',
		countryCodes: ['BR'],
		lat: -15.8,
		lng: -47.88,
		isLandmark: true,
	},
	{
		id: 'serpro-br',
		url: 'https://www.serpro.gov.br/favicon.ico',
		regionHint: 'Brasil (serpro.gov.br)',
		countryCodes: ['BR'],
		lat: -15.79,
		lng: -47.93,
		isLandmark: true,
	},
	{
		id: 'camara-br',
		url: 'https://www.camara.leg.br/favicon.ico',
		regionHint: 'Brasil (camara.leg.br)',
		countryCodes: ['BR'],
		lat: -15.8,
		lng: -47.86,
		isLandmark: true,
	},
	{
		id: 'nasa-us',
		url: 'https://www.nasa.gov/favicon.ico',
		regionHint: 'EUA (nasa.gov)',
		countryCodes: ['US'],
		lat: 38.88,
		lng: -77.01,
		isLandmark: true,
	},
	{
		id: 'bund-de',
		url: 'https://www.bund.de/favicon.ico',
		regionHint: 'Alemanha (bund.de)',
		countryCodes: ['DE'],
		lat: 52.52,
		lng: 13.4,
		isLandmark: true,
	},
	{
		id: 'go-jp',
		url: 'https://www.digital.go.jp/favicon.ico',
		regionHint: 'Japão (digital.go.jp)',
		countryCodes: ['JP'],
		lat: 35.68,
		lng: 139.76,
		isLandmark: true,
	},
	{
		id: 'gov-uk',
		url: 'https://www.gov.uk/favicon.ico',
		regionHint: 'Reino Unido (gov.uk)',
		countryCodes: ['GB'],
		lat: 51.5,
		lng: -0.12,
		isLandmark: true,
	},
	{
		id: 'riigiteataja-ee',
		url: 'https://www.riigiteataja.ee/favicon.ico',
		regionHint: 'Estônia (riigiteataja.ee)',
		countryCodes: ['EE'],
		lat: 59.44,
		lng: 24.75,
		isLandmark: true,
	},
	{
		id: 'cloudflare-global',
		url: 'https://www.cloudflare.com/cdn-cgi/trace',
		regionHint: 'Cloudflare anycast',
		countryCodes: [],
		lat: undefined,
		lng: undefined,
		isLandmark: false,
	},
]

type MeasuredSample = RttEndpoint & {
	readonly rttMs: number | undefined
}

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

function collectFastestCountryCodes(
	sorted: readonly MeasuredSample[],
): readonly string[] {
	const top = sorted.filter(sample => sample.rttMs !== undefined).slice(0, 3)
	const codes = top.flatMap(sample => [...sample.countryCodes])
	return [...new Set(codes)]
}

export async function runRttProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'Triangulação por latência (RTT)'
	const samples: MeasuredSample[] = await Promise.all(
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
	const countryCodes = collectFastestCountryCodes(sorted)
	const hasRegionPrior = countryCodes.length > 0

	const landmarks = measured.flatMap(sample => {
		if (
			!sample.isLandmark ||
			sample.rttMs === undefined ||
			sample.lat === undefined ||
			sample.lng === undefined
		) {
			return []
		}
		return [
			{
				id: sample.id,
				lat: sample.lat,
				lng: sample.lng,
				countryCodes: sample.countryCodes,
				rttMs: sample.rttMs,
			},
		]
	})

	const flatNeutralized = isFlatLandmarkRtt(landmarks)
	const lateration = flatNeutralized
		? undefined
		: softLaterateFromRtt(landmarks)
	const confidence = flatNeutralized
		? 0.38
		: lateration !== undefined
			? lateration.confidence
			: hasRegionPrior
				? Math.min(0.28, 0.14 + measured.length * 0.02)
				: 0.12

	return makeSignal({
		id: 'rtt_probe',
		label,
		status: 'ok',
		confidence,
		...(lateration !== undefined
			? {
					lat: lateration.lat,
					lng: lateration.lng,
					accuracyMeters: lateration.accuracyMeters,
				}
			: {}),
		summary: flatNeutralized
			? `RTT uniforme nos landmarks (~±${FLAT_HINT_MS} ms) — latência real provavelmente neutralizada (extensão/proxy).`
			: fastest
				? lateration !== undefined
					? `Lateração fraca (~±${Math.round(lateration.accuracyMeters / 1000)} km). Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms).`
					: hasRegionPrior
						? `Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms). Prioridades: ${countryCodes.join(', ')}.`
						: `Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms). Sinal fraco (sem prior de país).`
				: 'Amostras RTT coletadas.',
		regionHints: {
			countryCodes: flatNeutralized ? [] : [...countryCodes],
		},
		raw: {
			samples: samples.map(sample => ({
				id: sample.id,
				url: sample.url,
				regionHint: sample.regionHint,
				countryCodes: [...sample.countryCodes],
				rttMs: sample.rttMs === undefined ? null : Math.round(sample.rttMs),
				isLandmark: sample.isLandmark,
			})),
			fastestCountries: flatNeutralized ? [] : [...countryCodes],
			flatNeutralized,
			lateration:
				lateration === undefined
					? null
					: {
							lat: lateration.lat,
							lng: lateration.lng,
							accuracyMeters: lateration.accuracyMeters,
							confidence: lateration.confidence,
						},
			note: flatNeutralized
				? 'RTTs quase idênticos sugerem redirect local (spoof); coords de lateração omitidas.'
				: 'RTT a hosts regionais é lateração fraca; CDNs anycast e rota ISP podem distorcer.',
		},
	})
}
