import { countriesFromLocale } from '@features/location/lib/region-priors'

/**
 * Parse an Accept-Language header into ordered tags (without q weights).
 * Example: `pt-BR,pt;q=0.9,en-US;q=0.8` → `['pt-BR', 'pt', 'en-US']`
 */
export function parseAcceptLanguageTags(header: string): readonly string[] {
	const tags: string[] = []
	for (const part of header.split(',')) {
		const raw = part.trim()
		if (raw.length === 0) {
			continue
		}
		const tag = raw.split(';')[0]?.trim()
		if (tag === undefined || tag.length === 0) {
			continue
		}
		tags.push(tag.replace('_', '-'))
	}
	return tags
}

export function countriesFromAcceptLanguage(header: string): readonly string[] {
	return [
		...new Set(
			parseAcceptLanguageTags(header).flatMap(tag => [
				...countriesFromLocale(tag),
			]),
		),
	]
}
