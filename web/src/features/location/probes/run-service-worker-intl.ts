import type { LocationSignal } from '@features/location/api/location.schema'
import {
	countriesFromLocale,
	countriesFromTimezone,
} from '@features/location/lib/region-priors'
import { readIndexedStrings } from '@features/location/lib/safe-array'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface SwIntlReply {
	readonly timeZone: string
	readonly language: string
	readonly languages: readonly string[]
}

function parseSwIntlReply(value: unknown): SwIntlReply | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined
	}
	const timeZone: unknown = Reflect.get(value, 'timeZone')
	const language: unknown = Reflect.get(value, 'language')
	if (typeof timeZone !== 'string' || typeof language !== 'string') {
		return undefined
	}
	return {
		timeZone,
		language,
		languages: readIndexedStrings(Reflect.get(value, 'languages')),
	}
}

interface SwWorkerLike {
	readonly postMessage: (message: unknown) => void
	readonly addEventListener: (type: 'statechange', listener: () => void) => void
}

function isSwWorkerLike(value: unknown): value is SwWorkerLike {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	return (
		typeof Reflect.get(value, 'postMessage') === 'function' &&
		typeof Reflect.get(value, 'addEventListener') === 'function'
	)
}

function readRegistrationWorker(
	registration: ServiceWorkerRegistration,
): SwWorkerLike | null {
	try {
		const active: unknown = Reflect.get(registration, 'active')
		if (isSwWorkerLike(active)) {
			return active
		}
		const installing: unknown = Reflect.get(registration, 'installing')
		if (isSwWorkerLike(installing)) {
			return installing
		}
		const waiting: unknown = Reflect.get(registration, 'waiting')
		if (isSwWorkerLike(waiting)) {
			return waiting
		}
	} catch {
		return null
	}
	return null
}

function readWorkerScriptUrl(
	reg: ServiceWorkerRegistration,
): string | undefined {
	try {
		const active: unknown = Reflect.get(reg, 'active')
		if (typeof active === 'object' && active !== null) {
			const url: unknown = Reflect.get(active, 'scriptURL')
			if (typeof url === 'string') {
				return url
			}
		}
		const installing: unknown = Reflect.get(reg, 'installing')
		if (typeof installing === 'object' && installing !== null) {
			const url: unknown = Reflect.get(installing, 'scriptURL')
			if (typeof url === 'string') {
				return url
			}
		}
	} catch {
		return undefined
	}
	return undefined
}

const SW_SCRIPT_URL = '/locatone-sw-intl-probe.js'
const SW_SCOPE = '/locatone-sw-scope/'

async function unregisterProbeWorkers(): Promise<void> {
	if (!('serviceWorker' in navigator)) {
		return
	}
	try {
		const regs = await navigator.serviceWorker.getRegistrations()
		await Promise.all(
			regs
				.filter(reg => {
					const script = readWorkerScriptUrl(reg)
					return (
						typeof script === 'string' &&
						script.includes('locatone-sw-intl-probe')
					)
				})
				.map(reg => reg.unregister()),
		)
	} catch {
		/* Xray / permission — ignore cleanup */
	}
}

export async function runServiceWorkerIntlProbe(): Promise<LocationSignal> {
	const label = 'Service Worker Intl / idioma'
	if (!('serviceWorker' in navigator)) {
		return makeSignal({
			id: 'service_worker_intl',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Service Worker indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	let registration: ServiceWorkerRegistration | undefined
	try {
		await unregisterProbeWorkers()
		registration = await navigator.serviceWorker.register(SW_SCRIPT_URL, {
			scope: SW_SCOPE,
		})

		const worker = readRegistrationWorker(registration)
		if (worker === null) {
			return makeSignal({
				id: 'service_worker_intl',
				label,
				status: 'error',
				confidence: 0,
				summary: 'Service Worker sem estado ativo.',
				raw: { reason: 'no_worker' },
			})
		}

		const reply = await new Promise<SwIntlReply>((resolve, reject) => {
			const timer = globalThis.setTimeout(() => {
				reject(new Error('Service Worker Intl timeout'))
			}, 3_000)

			function onMessage(event: MessageEvent<unknown>) {
				const parsed = parseSwIntlReply(event.data)
				if (parsed === undefined) {
					return
				}
				globalThis.clearTimeout(timer)
				navigator.serviceWorker.removeEventListener('message', onMessage)
				resolve(parsed)
			}

			navigator.serviceWorker.addEventListener('message', onMessage)

			const deliver = () => {
				try {
					worker.postMessage('probe')
				} catch (error) {
					globalThis.clearTimeout(timer)
					navigator.serviceWorker.removeEventListener('message', onMessage)
					reject(
						error instanceof Error ? error : new Error('SW postMessage failed'),
					)
				}
			}

			let state = ''
			try {
				const stateUnknown: unknown = Reflect.get(worker, 'state')
				state = typeof stateUnknown === 'string' ? stateUnknown : ''
			} catch {
				state = ''
			}

			if (state === 'activated') {
				deliver()
			} else {
				worker.addEventListener('statechange', () => {
					try {
						const next: unknown = Reflect.get(worker, 'state')
						if (next === 'activated') {
							deliver()
						}
					} catch {
						/* ignore */
					}
				})
			}
		})

		const pageZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const pageLanguage = navigator.language
		const mismatch =
			reply.timeZone !== pageZone || reply.language !== pageLanguage
		const countryCodes = [
			...new Set([
				...countriesFromTimezone(reply.timeZone),
				...countriesFromLocale(reply.language),
			]),
		]

		return makeSignal({
			id: 'service_worker_intl',
			label,
			status: 'ok',
			confidence: mismatch ? 0.6 : countryCodes.length > 0 ? 0.35 : 0.15,
			summary: mismatch
				? `SW vê ${reply.timeZone} / ${reply.language}; página vê ${pageZone} / ${pageLanguage}.`
				: `Service Worker alinhado: ${reply.timeZone} / ${reply.language}.`,
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
			id: 'service_worker_intl',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao sondar Service Worker Intl.',
			raw: { error: String(error) },
		})
	} finally {
		try {
			if (registration !== undefined) {
				await registration.unregister()
			} else {
				await unregisterProbeWorkers()
			}
		} catch {
			/* best-effort cleanup */
		}
	}
}
