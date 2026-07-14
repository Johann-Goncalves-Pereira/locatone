import type { LocationSignal } from '@features/location/api/location.schema'
import { countriesFromTimezone } from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface WorkerIntlReply {
	readonly timeZone: string
	readonly language: string
	readonly languages: readonly string[]
}

function isWorkerIntlReply(value: unknown): value is WorkerIntlReply {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const timeZone: unknown = Reflect.get(value, 'timeZone')
	const language: unknown = Reflect.get(value, 'language')
	const languages: unknown = Reflect.get(value, 'languages')
	return (
		typeof timeZone === 'string' &&
		typeof language === 'string' &&
		Array.isArray(languages) &&
		languages.every(item => typeof item === 'string')
	)
}

export async function runWorkerIntlProbe(): Promise<LocationSignal> {
	const label = 'Worker Intl / idioma'
	if (typeof Worker === 'undefined' || typeof URL === 'undefined') {
		return makeSignal({
			id: 'worker_intl',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Web Worker indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	const source = `
self.onmessage = function () {
  var opts = Intl.DateTimeFormat().resolvedOptions();
  var languages = [];
  try {
    languages = Array.prototype.slice.call(self.navigator.languages || []);
  } catch (e) {}
  self.postMessage({
    timeZone: opts.timeZone || '',
    language: self.navigator.language || '',
    languages: languages
  });
};
`
	let objectUrl: string | undefined
	try {
		const blob = new Blob([source], { type: 'text/javascript' })
		const createdUrl = URL.createObjectURL(blob)
		objectUrl = createdUrl
		const reply = await new Promise<WorkerIntlReply>((resolve, reject) => {
			const worker = new Worker(createdUrl)
			const timer = globalThis.setTimeout(() => {
				worker.terminate()
				reject(new Error('Worker Intl timeout'))
			}, 2_500)
			worker.onmessage = (event: MessageEvent<unknown>) => {
				globalThis.clearTimeout(timer)
				worker.terminate()
				if (isWorkerIntlReply(event.data)) {
					resolve(event.data)
					return
				}
				reject(new Error('Worker Intl reply inválida'))
			}
			worker.onerror = () => {
				globalThis.clearTimeout(timer)
				worker.terminate()
				reject(new Error('Worker Intl falhou'))
			}
			worker.postMessage('probe')
		})

		const pageZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const pageLanguage = navigator.language
		const mismatch =
			reply.timeZone !== pageZone || reply.language !== pageLanguage
		const countryCodes = [...countriesFromTimezone(reply.timeZone)]

		return makeSignal({
			id: 'worker_intl',
			label,
			status: 'ok',
			confidence: mismatch ? 0.55 : countryCodes.length > 0 ? 0.35 : 0.15,
			summary: mismatch
				? `Worker vê ${reply.timeZone} / ${reply.language}; página vê ${pageZone} / ${pageLanguage}.`
				: `Worker alinhado: ${reply.timeZone} / ${reply.language}.`,
			regionHints: {
				timezone: reply.timeZone,
				countryCodes,
				languages: [reply.language, ...reply.languages],
			},
			raw: {
				worker: reply,
				page: { timeZone: pageZone, language: pageLanguage },
				mismatch,
			},
		})
	} catch (error) {
		return makeSignal({
			id: 'worker_intl',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Falha ao sondar Worker Intl.',
			raw: { error: String(error) },
		})
	} finally {
		if (objectUrl !== undefined) {
			URL.revokeObjectURL(objectUrl)
		}
	}
}
