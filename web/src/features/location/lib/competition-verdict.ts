import type { LocationSignal } from '@features/location/api/location.schema'

export type CompetitionVerdict =
	| 'aligned_spoof'
	| 'brazil_leak'
	| 'inconclusive'

export interface CompetitionVerdictResult {
	readonly kind: CompetitionVerdict
	readonly label: string
	readonly detail: string
	readonly leakSources: readonly string[]
}

const COMPETITION_TRUTH = 'Mandirituba (BR)'
const COMPETITION_SPOOF = 'Tallinn (EE)'

function readRawFlag(raw: unknown, key: string): boolean {
	if (typeof raw !== 'object' || raw === null) {
		return false
	}
	return Reflect.get(raw, key) === true
}

function hasCountry(signal: LocationSignal | undefined, code: string): boolean {
	return (
		signal?.status === 'ok' &&
		(signal.regionHints?.countryCodes ?? []).includes(code)
	)
}

const LEAK_PROBE_LABELS: Readonly<Record<string, string>> = {
	accept_language: 'Accept-Language',
	speech_voices: 'vozes',
	iframe_intl: 'iframe',
	service_worker_intl: 'Service Worker',
	worker_intl: 'Worker',
	date_string_tz: 'Date#toString',
}

function isLeakProbe(signal: LocationSignal): boolean {
	if (signal.status !== 'ok') {
		return false
	}
	if (signal.id === 'accept_language') {
		return hasCountry(signal, 'BR') || readRawFlag(signal.raw, 'mismatch')
	}
	if (signal.id === 'speech_voices') {
		return hasCountry(signal, 'BR') || readRawFlag(signal.raw, 'hasPtBr')
	}
	if (
		signal.id === 'iframe_intl' ||
		signal.id === 'service_worker_intl' ||
		signal.id === 'worker_intl'
	) {
		return readRawFlag(signal.raw, 'mismatch') || hasCountry(signal, 'BR')
	}
	if (signal.id === 'date_string_tz') {
		return readRawFlag(signal.raw, 'offsetMismatch') || hasCountry(signal, 'BR')
	}
	return false
}

/**
 * Competition fixture verdict: Tallinn spoof held vs Mandirituba client leak.
 * With ProtonVPN, IP/edge often say EE — client leftovers are the aces.
 */
export function competitionVerdict(
	signals: readonly LocationSignal[],
): CompetitionVerdictResult {
	const leakSources = signals
		.filter(isLeakProbe)
		.map(signal => LEAK_PROBE_LABELS[signal.id] ?? signal.id)

	const ipVsTz = signals.find(signal => signal.id === 'ip_vs_tz')
	const conflicted =
		ipVsTz?.status === 'ok' && readRawFlag(ipVsTz.raw, 'conflicted')

	const uniqueLeaks = [...new Set(leakSources)]

	if (uniqueLeaks.length > 0 || conflicted) {
		return {
			kind: 'brazil_leak',
			label: 'Vazamento BR detectado',
			detail:
				uniqueLeaks.length > 0
					? `Sinais ainda apontam ${COMPETITION_TRUTH}: ${uniqueLeaks.join(', ')}. IP/VPN pode dizer ${COMPETITION_SPOOF}.`
					: `Conflitos regionais sob a máscara de ${COMPETITION_SPOOF}.`,
			leakSources: uniqueLeaks,
		}
	}

	const spoofAligned = signals.some(
		signal =>
			(signal.id === 'timezone' ||
				signal.id === 'locale' ||
				signal.id === 'gps') &&
			hasCountry(signal, 'EE'),
	)

	if (spoofAligned) {
		return {
			kind: 'aligned_spoof',
			label: 'Consenso Tallinn',
			detail: `Cliente alinhado com ${COMPETITION_SPOOF}; sem vazamento BR óbvio.`,
			leakSources: [],
		}
	}

	return {
		kind: 'inconclusive',
		label: 'Sem veredito',
		detail: 'Sinais insuficientes para o enfrentamento Mandirituba × Tallinn.',
		leakSources: [],
	}
}
