import type { LocationSignal } from '@features/location/api/location.schema'
import {
	type KeyboardLayoutId,
	countriesFromKeyboardLayout,
	inferKeyboardLayout,
} from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

const LAYOUT_LABEL: Readonly<Record<KeyboardLayoutId, string>> = {
	azerty: 'AZERTY',
	qwertz: 'QWERTZ',
	jis: 'JIS',
	qwerty: 'QWERTY',
	unknown: 'desconhecido',
}

function hasKeyboardApi(value: Navigator): value is Navigator & {
	readonly keyboard: {
		getLayoutMap: () => Promise<ReadonlyMap<string, string>>
	}
} {
	return (
		'keyboard' in value &&
		typeof value.keyboard === 'object' &&
		value.keyboard !== null &&
		typeof Reflect.get(value.keyboard, 'getLayoutMap') === 'function'
	)
}

export async function runKeyboardLayoutProbe(): Promise<LocationSignal> {
	const label = 'Layout de teclado'
	if (!hasKeyboardApi(navigator)) {
		return makeSignal({
			id: 'keyboard_layout',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Keyboard API indisponível neste ambiente.',
			raw: { reason: 'unsupported' },
		})
	}

	try {
		const layoutMap = await navigator.keyboard.getLayoutMap()
		const entries = [...layoutMap.entries()].slice(0, 40)
		const layoutId = inferKeyboardLayout(layoutMap)
		const countryCodes = countriesFromKeyboardLayout(layoutId)
		const soft =
			layoutId === 'qwerty' ||
			layoutId === 'unknown' ||
			countryCodes.length === 0

		return makeSignal({
			id: 'keyboard_layout',
			label,
			status: 'ok',
			confidence: soft ? 0.08 : 0.22,
			summary: soft
				? `Layout ${LAYOUT_LABEL[layoutId]} (prior regional fraca ou ambígua).`
				: `Layout ${LAYOUT_LABEL[layoutId]} → prior ${countryCodes.join(', ')}.`,
			regionHints: {
				countryCodes: [...countryCodes],
			},
			raw: {
				layoutId,
				sampleEntries: Object.fromEntries(entries),
			},
		})
	} catch (error) {
		return makeSignal({
			id: 'keyboard_layout',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao ler layout de teclado.',
			raw: { error: String(error) },
		})
	}
}
