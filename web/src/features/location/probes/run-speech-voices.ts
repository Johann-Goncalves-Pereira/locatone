import type { LocationSignal } from '@features/location/api/location.schema'
import { countriesFromLocale } from '@features/location/lib/region-priors'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface VoiceSample {
	readonly name: string
	readonly lang: string
	readonly localService: boolean
	readonly default: boolean
}

function sampleVoices(voices: readonly SpeechSynthesisVoice[]): {
	readonly samples: readonly VoiceSample[]
	readonly langs: readonly string[]
	readonly countryCodes: readonly string[]
} {
	const samples = voices.slice(0, 40).map(voice => ({
		name: voice.name,
		lang: voice.lang,
		localService: voice.localService,
		default: voice.default,
	}))
	const langs = [...new Set(voices.map(voice => voice.lang).filter(Boolean))]
	const countryCodes = [
		...new Set(langs.flatMap(lang => [...countriesFromLocale(lang)])),
	]
	return { samples, langs, countryCodes }
}

function waitForVoices(): Promise<readonly SpeechSynthesisVoice[]> {
	const synth = window.speechSynthesis
	const existing = synth.getVoices()
	if (existing.length > 0) {
		return Promise.resolve(existing)
	}
	return new Promise(resolve => {
		const timer = window.setTimeout(() => {
			synth.removeEventListener('voiceschanged', onChange)
			resolve(synth.getVoices())
		}, 1_500)
		function onChange() {
			window.clearTimeout(timer)
			synth.removeEventListener('voiceschanged', onChange)
			resolve(synth.getVoices())
		}
		synth.addEventListener('voiceschanged', onChange)
	})
}

export async function runSpeechVoicesProbe(): Promise<LocationSignal> {
	const label = 'Vozes de síntese (speechSynthesis)'
	if (typeof window.speechSynthesis === 'undefined') {
		return makeSignal({
			id: 'speech_voices',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'speechSynthesis indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	try {
		const voices = await waitForVoices()
		if (voices.length === 0) {
			return makeSignal({
				id: 'speech_voices',
				label,
				status: 'ok',
				confidence: 0.05,
				summary: 'Nenhuma voz de síntese reportada.',
				raw: { voiceCount: 0 },
			})
		}

		const { samples, langs, countryCodes } = sampleVoices(voices)
		const hasPtBr = langs.some(
			lang =>
				lang.toLowerCase() === 'pt-br' ||
				lang.toLowerCase().startsWith('pt-br') ||
				lang.toLowerCase() === 'pt_br',
		)
		const hasEt = langs.some(lang => {
			const lower = lang.toLowerCase()
			return lower === 'et' || lower.startsWith('et-') || lower === 'et_ee'
		})

		return makeSignal({
			id: 'speech_voices',
			label,
			status: 'ok',
			confidence: hasPtBr ? 0.6 : countryCodes.length > 0 ? 0.35 : 0.15,
			summary: hasPtBr
				? `Vozes pt-BR detectadas (${String(voices.length)} vozes); prior BR forte.`
				: hasEt
					? `Vozes estonianas presentes (${String(voices.length)} vozes).`
					: countryCodes.length > 0
						? `Vozes sugerem ${countryCodes.join(', ')} (${String(voices.length)} vozes).`
						: `${String(voices.length)} vozes sem prior regional claro.`,
			regionHints: {
				languages: [...langs],
				countryCodes,
			},
			raw: {
				voiceCount: voices.length,
				langs,
				hasPtBr,
				hasEt,
				samples,
			},
		})
	} catch (error) {
		return makeSignal({
			id: 'speech_voices',
			label,
			status: 'error',
			confidence: 0,
			summary:
				error instanceof Error
					? error.message
					: 'Falha ao listar vozes de síntese.',
			raw: { error: String(error) },
		})
	}
}
