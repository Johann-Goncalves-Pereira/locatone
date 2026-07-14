import type { LocationSignal } from '@features/location/api/location.schema'
import {
	countriesFromLocale,
	countriesFromTimezone,
} from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface IframeIntlSample {
	readonly timeZone: string
	readonly language: string
	readonly languages: readonly string[]
}

function readIframeIntl(win: Window): IframeIntlSample | undefined {
	try {
		const intlUnknown: unknown = Reflect.get(win, 'Intl')
		if (typeof intlUnknown !== 'object' || intlUnknown === null) {
			return undefined
		}
		const DateTimeFormatUnknown: unknown = Reflect.get(
			intlUnknown,
			'DateTimeFormat',
		)
		if (typeof DateTimeFormatUnknown !== 'function') {
			return undefined
		}
		const formatter: unknown = Reflect.construct(DateTimeFormatUnknown, [])
		if (typeof formatter !== 'object' || formatter === null) {
			return undefined
		}
		const resolvedUnknown: unknown = Reflect.get(formatter, 'resolvedOptions')
		if (typeof resolvedUnknown !== 'function') {
			return undefined
		}
		const resolved: unknown = Reflect.apply(resolvedUnknown, formatter, [])
		if (typeof resolved !== 'object' || resolved === null) {
			return undefined
		}
		const timeZone: unknown = Reflect.get(resolved, 'timeZone')
		const navUnknown: unknown = Reflect.get(win, 'navigator')
		if (typeof navUnknown !== 'object' || navUnknown === null) {
			return undefined
		}
		const language: unknown = Reflect.get(navUnknown, 'language')
		const languagesUnknown: unknown = Reflect.get(navUnknown, 'languages')
		if (typeof timeZone !== 'string' || typeof language !== 'string') {
			return undefined
		}
		const languages =
			Array.isArray(languagesUnknown) &&
			languagesUnknown.every(item => typeof item === 'string')
				? languagesUnknown
				: []
		return { timeZone, language, languages }
	} catch {
		return undefined
	}
}

export function runIframeIntlProbe(): LocationSignal {
	const label = 'Iframe Intl / idioma'
	if (typeof document === 'undefined') {
		return makeSignal({
			id: 'iframe_intl',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Documento indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	const iframe = document.createElement('iframe')
	iframe.setAttribute('aria-hidden', 'true')
	iframe.style.cssText =
		'position:absolute;width:0;height:0;border:0;visibility:hidden'
	iframe.src = 'about:blank'

	try {
		document.documentElement.appendChild(iframe)
		const frameWin = iframe.contentWindow
		if (frameWin === null) {
			return makeSignal({
				id: 'iframe_intl',
				label,
				status: 'error',
				confidence: 0,
				summary: 'Não foi possível acessar o iframe.',
				raw: { reason: 'no_content_window' },
			})
		}

		// Read immediately — races content-script injection on about:blank.
		const sample = readIframeIntl(frameWin)
		if (sample === undefined) {
			return makeSignal({
				id: 'iframe_intl',
				label,
				status: 'error',
				confidence: 0,
				summary: 'Leitura Intl no iframe falhou.',
				raw: { reason: 'read_failed' },
			})
		}

		const pageZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const pageLanguage = navigator.language
		const mismatch =
			sample.timeZone !== pageZone || sample.language !== pageLanguage
		const countryCodes = [
			...new Set([
				...countriesFromTimezone(sample.timeZone),
				...countriesFromLocale(sample.language),
			]),
		]

		return makeSignal({
			id: 'iframe_intl',
			label,
			status: 'ok',
			confidence: mismatch ? 0.6 : countryCodes.length > 0 ? 0.3 : 0.15,
			summary: mismatch
				? `Iframe vê ${sample.timeZone} / ${sample.language}; página vê ${pageZone} / ${pageLanguage}.`
				: `Iframe alinhado: ${sample.timeZone} / ${sample.language}.`,
			regionHints: {
				timezone: sample.timeZone,
				countryCodes,
				languages: [sample.language, ...sample.languages],
			},
			raw: {
				iframe: sample,
				page: { timeZone: pageZone, language: pageLanguage },
				mismatch,
			},
		})
	} catch (error) {
		return makeSignal({
			id: 'iframe_intl',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error ? error.message : 'Falha ao sondar iframe Intl.',
			raw: { error: String(error) },
		})
	} finally {
		iframe.remove()
	}
}
