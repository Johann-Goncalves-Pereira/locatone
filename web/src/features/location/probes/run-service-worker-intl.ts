import type { LocationSignal } from '@features/location/api/location.schema'
import {
	countriesFromLocale,
	countriesFromTimezone,
} from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface SwIntlReply {
	readonly timeZone: string
	readonly language: string
	readonly languages: readonly string[]
}

function isSwIntlReply(value: unknown): value is SwIntlReply {
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

const SW_SCRIPT_URL = '/locatone-sw-intl-probe.js'
const SW_SCOPE = '/locatone-sw-scope/'

async function unregisterProbeWorkers(): Promise<void> {
	if (!('serviceWorker' in navigator)) {
		return
	}
	const regs = await navigator.serviceWorker.getRegistrations()
	await Promise.all(
		regs
			.filter(reg => {
				const script = reg.active?.scriptURL ?? reg.installing?.scriptURL
				return (
					typeof script === 'string' &&
					script.includes('locatone-sw-intl-probe')
				)
			})
			.map(reg => reg.unregister()),
	)
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

		const worker =
			registration.active ?? registration.installing ?? registration.waiting
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
				if (!isSwIntlReply(event.data)) {
					return
				}
				globalThis.clearTimeout(timer)
				navigator.serviceWorker.removeEventListener('message', onMessage)
				resolve(event.data)
			}

			navigator.serviceWorker.addEventListener('message', onMessage)

			const deliver = () => {
				worker.postMessage('probe')
			}

			if (worker.state === 'activated') {
				deliver()
			} else {
				worker.addEventListener('statechange', () => {
					if (worker.state === 'activated') {
						deliver()
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
