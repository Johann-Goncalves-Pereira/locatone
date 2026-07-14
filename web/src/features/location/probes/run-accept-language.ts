import { fetchClientHeadersPromise } from '@features/location/api/client-headers.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import {
	countriesFromAcceptLanguage,
	parseAcceptLanguageTags,
} from '@features/location/lib/parse-accept-language'
import { makeSignal } from '@features/location/probes/signal-helpers'

export async function runAcceptLanguageProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'Accept-Language (cabeçalho HTTP)'
	try {
		const data = await fetchClientHeadersPromise(signal)

		if (!data.available) {
			return makeSignal({
				id: 'accept_language',
				label,
				status: 'unsupported',
				confidence: 0,
				summary:
					data.reason === 'missing_endpoint'
						? 'Endpoint /api/client-headers ausente.'
						: 'Cabeçalhos do cliente indisponíveis.',
				raw: { ...data },
			})
		}

		const header = data.acceptLanguage
		if (header === undefined || header.trim().length === 0) {
			return makeSignal({
				id: 'accept_language',
				label,
				status: 'ok',
				confidence: 0.1,
				summary: 'Accept-Language ausente na requisição.',
				raw: { ...data },
			})
		}

		const tags = parseAcceptLanguageTags(header)
		const countryCodes = countriesFromAcceptLanguage(header)
		const pageLanguage = navigator.language
		const headerPrimary = tags[0]
		const mismatch =
			headerPrimary !== undefined &&
			headerPrimary.toLowerCase() !== pageLanguage.toLowerCase() &&
			!pageLanguage.toLowerCase().startsWith(headerPrimary.toLowerCase())

		return makeSignal({
			id: 'accept_language',
			label,
			status: 'ok',
			confidence: mismatch ? 0.65 : countryCodes.length > 0 ? 0.45 : 0.2,
			summary: mismatch
				? `Cabeçalho ${header} diverge de navigator.language (${pageLanguage}).`
				: countryCodes.length > 0
					? `Accept-Language sugere ${countryCodes.join(', ')}: ${header}.`
					: `Accept-Language: ${header}.`,
			regionHints: {
				languages: [...tags],
				countryCodes,
			},
			raw: {
				acceptLanguage: header,
				tags,
				pageLanguage,
				mismatch,
			},
		})
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
		return makeSignal({
			id: 'accept_language',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao ler Accept-Language.',
			raw: { error: String(error) },
		})
	}
}
