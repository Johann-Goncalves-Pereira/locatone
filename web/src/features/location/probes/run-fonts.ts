import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface FontProbe {
	readonly id: string
	readonly sample: string
	readonly fonts: readonly string[]
	readonly countryCodes: readonly string[]
	readonly label: string
}

const FONT_PROBES: readonly FontProbe[] = [
	{
		id: 'cjk',
		sample: '漢字仮名',
		fonts: ['Hiragino Sans', 'Yu Gothic', 'Microsoft YaHei', 'Noto Sans CJK'],
		countryCodes: ['JP', 'CN', 'KR', 'TW'],
		label: 'CJK',
	},
	{
		id: 'arabic',
		sample: 'مرحبا',
		fonts: ['Tahoma', 'Arabic Typesetting', 'Noto Naskh Arabic', 'Geeza Pro'],
		countryCodes: ['SA', 'EG', 'AE'],
		label: 'Árabe',
	},
	{
		id: 'devanagari',
		sample: 'नमस्ते',
		fonts: ['Nirmala UI', 'Devanagari Sangam MN', 'Noto Sans Devanagari'],
		countryCodes: ['IN'],
		label: 'Devanágari',
	},
	{
		id: 'cyrillic',
		sample: 'Привет',
		fonts: ['PT Sans', 'Segoe UI', 'Arial'],
		countryCodes: ['RU'],
		label: 'Cirílico',
	},
]

function measureWidth(text: string, fontFamily: string): number {
	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')
	if (context === null) {
		return 0
	}
	context.font = `16px ${fontFamily}, monospace`
	return context.measureText(text).width
}

function detectFont(sample: string, fonts: readonly string[]): boolean {
	const baseline = measureWidth(sample, 'monospace')
	return fonts.some(font => {
		const width = measureWidth(sample, font)
		return Math.abs(width - baseline) > 0.5
	})
}

export function runFontLocaleProbe(): LocationSignal {
	const label = 'Fontes regionais instaladas'
	if (typeof document === 'undefined') {
		return makeSignal({
			id: 'font_locale',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Document indisponível.',
			raw: { reason: 'no-document' },
		})
	}

	const results = FONT_PROBES.map(probe => ({
		id: probe.id,
		label: probe.label,
		detected: detectFont(probe.sample, probe.fonts),
		countryCodes: probe.countryCodes,
	}))

	const hits = results.filter(result => result.detected)
	const countries = [...new Set(hits.flatMap(hit => hit.countryCodes))]

	return makeSignal({
		id: 'font_locale',
		label,
		status: 'ok',
		confidence: hits.length > 0 ? 0.22 : 0.08,
		summary:
			hits.length > 0
				? `Fontes sugerem scripts: ${hits.map(hit => hit.label).join(', ')}.`
				: 'Nenhuma fonte regional distintiva detectada.',
		regionHints: { countryCodes: countries },
		raw: { results },
	})
}
