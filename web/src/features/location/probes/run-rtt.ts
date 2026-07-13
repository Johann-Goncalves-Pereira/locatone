import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface RttEndpoint {
	readonly id: string
	readonly url: string
	readonly regionHint: string
	readonly countryCodes: readonly string[]
}

/** Region-labeled hosts (soft priors). Anycast CDNs may still skew RTT. */
const ENDPOINTS: readonly RttEndpoint[] = [
	{
		id: 'gov-br',
		url: 'https://www.gov.br/favicon.ico',
		regionHint: 'Brasil (gov.br)',
		countryCodes: ['BR'],
	},
	{
		id: 'nasa-us',
		url: 'https://www.nasa.gov/favicon.ico',
		regionHint: 'EUA (nasa.gov)',
		countryCodes: ['US'],
	},
	{
		id: 'bund-de',
		url: 'https://www.bund.de/favicon.ico',
		regionHint: 'Alemanha (bund.de)',
		countryCodes: ['DE'],
	},
	{
		id: 'go-jp',
		url: 'https://www.digital.go.jp/favicon.ico',
		regionHint: 'Japão (digital.go.jp)',
		countryCodes: ['JP'],
	},
	{
		id: 'gov-uk',
		url: 'https://www.gov.uk/favicon.ico',
		regionHint: 'Reino Unido (gov.uk)',
		countryCodes: ['GB'],
	},
	{
		id: 'cloudflare-global',
		url: 'https://www.cloudflare.com/cdn-cgi/trace',
		regionHint: 'Cloudflare anycast',
		countryCodes: [],
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
	const confidence = hasRegionPrior
		? Math.min(0.28, 0.14 + measured.length * 0.02)
		: 0.12

	return makeSignal({
		id: 'rtt_probe',
		label,
		status: 'ok',
		confidence,
		summary: fastest
			? hasRegionPrior
				? `Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms). Prioridades: ${countryCodes.join(', ')}.`
				: `Menor RTT: ${fastest.regionHint} (~${Math.round(fastest.rttMs ?? 0)} ms). Sinal fraco (sem prior de país).`
			: 'Amostras RTT coletadas.',
		regionHints: {
			countryCodes: [...countryCodes],
		},
		raw: {
			samples: samples.map(sample => ({
				id: sample.id,
				url: sample.url,
				regionHint: sample.regionHint,
				countryCodes: [...sample.countryCodes],
				rttMs: sample.rttMs === undefined ? null : Math.round(sample.rttMs),
			})),
			fastestCountries: [...countryCodes],
			note: 'RTT a hosts regionais é prior fraca; CDNs anycast e rota ISP podem distorcer.',
		},
	})
}
