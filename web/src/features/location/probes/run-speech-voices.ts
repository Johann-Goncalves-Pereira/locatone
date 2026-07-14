import type { LocationSignal } from '@features/location/api/location.schema'
import { countriesFromLocale } from '@features/location/lib/region-priors'
import {
	readArrayLength,
	readIndexedUnknown,
} from '@features/location/lib/safe-array'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface VoiceSample {
	readonly name: string
	readonly lang: string
	readonly localService: boolean
	readonly default: boolean
}

function readVoiceField(voice: unknown, key: string): unknown {
	if (typeof voice !== 'object' || voice === null) {
		return undefined
	}
	try {
		return Reflect.get(voice, key)
	} catch {
		return undefined
	}
}

function sampleVoices(voices: unknown): {
	readonly samples: readonly VoiceSample[]
	readonly langs: readonly string[]
	readonly countryCodes: readonly string[]
	readonly voiceCount: number
} {
	const items = readIndexedUnknown(voices)
	const samples: VoiceSample[] = []
	const langs: string[] = []
	for (const voice of items.slice(0, 40)) {
		const name = readVoiceField(voice, 'name')
		const lang = readVoiceField(voice, 'lang')
		const localService = readVoiceField(voice, 'localService')
		const isDefault = readVoiceField(voice, 'default')
		if (typeof lang === 'string' && lang.length > 0) {
			langs.push(lang)
		}
		samples.push({
			name: typeof name === 'string' ? name : '',
			lang: typeof lang === 'string' ? lang : '',
			localService: localService === true,
			default: isDefault === true,
		})
	}
	const uniqueLangs = [...new Set(langs)]
	const countryCodes = [
		...new Set(uniqueLangs.flatMap(lang => [...countriesFromLocale(lang)])),
	]
	return {
		samples,
		langs: uniqueLangs,
		countryCodes,
		voiceCount: readArrayLength(voices),
	}
}

function waitForVoices(): Promise<unknown> {
	const synth = window.speechSynthesis
	const existing = synth.getVoices()
	if (readArrayLength(existing) > 0) {
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
		const { samples, langs, countryCodes, voiceCount } = sampleVoices(voices)
		if (voiceCount === 0) {
			return makeSignal({
				id: 'speech_voices',
				label,
				status: 'ok',
				confidence: 0.05,
				summary: 'Nenhuma voz de síntese reportada.',
				raw: { voiceCount: 0 },
			})
		}

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
				? `Vozes pt-BR detectadas (${String(voiceCount)} vozes); prior BR forte.`
				: hasEt
					? `Vozes estonianas presentes (${String(voiceCount)} vozes).`
					: countryCodes.length > 0
						? `Vozes sugerem ${countryCodes.join(', ')} (${String(voiceCount)} vozes).`
						: `${String(voiceCount)} vozes sem prior regional claro.`,
			regionHints: {
				languages: [...langs],
				countryCodes,
			},
			raw: {
				voiceCount,
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
