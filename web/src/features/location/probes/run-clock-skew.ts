import { env } from '@lib/env'

import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

async function fetchServerDateMs(
	signal?: AbortSignal,
): Promise<number | undefined> {
	try {
		const response = await fetch(env.VITE_CLOUDFLARE_TRACE_URL.href, {
			method: 'GET',
			mode: 'cors',
			cache: 'no-store',
			...(signal === undefined ? {} : { signal }),
		})
		const header = response.headers.get('date')
		if (header === null) {
			return undefined
		}
		const parsed = Date.parse(header)
		return Number.isNaN(parsed) ? undefined : parsed
	} catch {
		return undefined
	}
}

function samplePerformanceJitterMs(durationMs: number): Promise<number> {
	return new Promise(resolve => {
		const samples: number[] = []
		const started = performance.now()
		const tick = () => {
			const now = performance.now()
			samples.push(now)
			if (now - started >= durationMs) {
				if (samples.length < 2) {
					resolve(0)
					return
				}
				const deltas: number[] = []
				for (let index = 1; index < samples.length; index += 1) {
					const previous = samples[index - 1]
					const current = samples[index]
					if (previous === undefined || current === undefined) {
						continue
					}
					deltas.push(current - previous)
				}
				if (deltas.length === 0) {
					resolve(0)
					return
				}
				const mean =
					deltas.reduce((sum, value) => sum + value, 0) / deltas.length
				const variance =
					deltas.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
					deltas.length
				resolve(Math.sqrt(variance))
				return
			}
			requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
	})
}

export async function runClockSkewProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'Deriva do relógio'
	const clientBefore = Date.now()
	const serverMs = await fetchServerDateMs(signal)
	const clientAfter = Date.now()
	const clientMid = (clientBefore + clientAfter) / 2
	const jitterMs = await samplePerformanceJitterMs(1_200)

	if (serverMs === undefined) {
		return makeSignal({
			id: 'clock_skew',
			label,
			status: 'ok',
			confidence: 0.1,
			summary: `Jitter de performance ~${jitterMs.toFixed(2)} ms; sem Date do servidor.`,
			raw: {
				serverDateMs: null,
				clientMidMs: clientMid,
				offsetMs: null,
				jitterMs,
				note: 'Curva térmica climática precisa de horas de observação; aqui só offset curto.',
			},
		})
	}

	const offsetMs = clientMid - serverMs
	const absOffset = Math.abs(offsetMs)
	const largeSkew = absOffset > 60_000

	return makeSignal({
		id: 'clock_skew',
		label,
		status: 'ok',
		confidence: largeSkew ? 0.3 : 0.15,
		summary: largeSkew
			? `Relógio local deslocado ~${Math.round(absOffset / 1000)} s vs servidor (skew).`
			: `Offset vs servidor ~${Math.round(offsetMs)} ms; jitter ~${jitterMs.toFixed(2)} ms.`,
		raw: {
			serverDateMs: serverMs,
			clientMidMs: clientMid,
			offsetMs,
			jitterMs,
			largeSkew,
			note: 'Metadado de sessão; não infere cidade. Deriva térmica climática exige observação longa.',
		},
	})
}
