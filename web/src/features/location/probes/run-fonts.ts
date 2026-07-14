import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface FontProbe {
	readonly id: string
	readonly sample: string
	readonly fonts: readonly string[]
	readonly countryCodes: readonly string[]
	readonly label: string
}

interface EmojiProbe {
	readonly id: string
	readonly emoji: string
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
		id: 'hangul',
		sample: '한글',
		fonts: ['Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR'],
		countryCodes: ['KR'],
		label: 'Hangul',
	},
	{
		id: 'arabic',
		sample: 'مرحبا',
		fonts: ['Tahoma', 'Arabic Typesetting', 'Noto Naskh Arabic', 'Geeza Pro'],
		countryCodes: ['SA', 'EG', 'AE'],
		label: 'Árabe',
	},
	{
		id: 'hebrew',
		sample: 'שלום',
		fonts: ['Arial Hebrew', 'Lucida Grande', 'Noto Sans Hebrew'],
		countryCodes: ['IL'],
		label: 'Hebraico',
	},
	{
		id: 'thai',
		sample: 'สวัสดี',
		fonts: ['Thonburi', 'Leelawadee UI', 'Noto Sans Thai'],
		countryCodes: ['TH'],
		label: 'Tailandês',
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

const EMOJI_PROBES: readonly EmojiProbe[] = [
	{
		id: 'flag-br',
		emoji: '🇧🇷',
		countryCodes: ['BR'],
		label: 'Bandeira BR',
	},
	{
		id: 'flag-jp',
		emoji: '🇯🇵',
		countryCodes: ['JP'],
		label: 'Bandeira JP',
	},
	{
		id: 'flag-de',
		emoji: '🇩🇪',
		countryCodes: ['DE'],
		label: 'Bandeira DE',
	},
	{
		id: 'regional-yen',
		emoji: '💴',
		countryCodes: ['JP'],
		label: 'Iene',
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

/** Glyph present if not collapsed to tofu-width of replacement char. */
export function detectEmojiGlyph(emoji: string): boolean {
	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')
	if (context === null) {
		return false
	}
	context.font = '32px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
	const emojiWidth = context.measureText(emoji).width
	const tofuWidth = context.measureText('\uFFFD').width
	return emojiWidth > tofuWidth * 1.2 && emojiWidth > 8
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

	const fontResults = FONT_PROBES.map(probe => ({
		id: probe.id,
		label: probe.label,
		detected: detectFont(probe.sample, probe.fonts),
		countryCodes: probe.countryCodes,
	}))

	const emojiResults = EMOJI_PROBES.map(probe => ({
		id: probe.id,
		label: probe.label,
		detected: detectEmojiGlyph(probe.emoji),
		countryCodes: probe.countryCodes,
	}))

	const fontHits = fontResults.filter(result => result.detected)
	const emojiHits = emojiResults.filter(result => result.detected)
	const countries = [
		...new Set([
			...fontHits.flatMap(hit => hit.countryCodes),
			...emojiHits.flatMap(hit => hit.countryCodes),
		]),
	]

	const independentHits = fontHits.length + (emojiHits.length > 0 ? 1 : 0)
	const confidence =
		independentHits >= 2
			? Math.min(0.32, 0.18 + independentHits * 0.04)
			: fontHits.length > 0 || emojiHits.length > 0
				? 0.22
				: 0.08

	const hitLabels = [
		...fontHits.map(hit => hit.label),
		...emojiHits.map(hit => hit.label),
	]

	return makeSignal({
		id: 'font_locale',
		label,
		status: 'ok',
		confidence,
		summary:
			hitLabels.length > 0
				? `Scripts/emojis: ${hitLabels.join(', ')}.`
				: 'Nenhuma fonte regional distintiva detectada.',
		regionHints: { countryCodes: countries },
		raw: { fontResults, emojiResults },
	})
}
