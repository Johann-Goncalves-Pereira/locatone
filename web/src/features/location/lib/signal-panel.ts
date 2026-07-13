import type {
	Agreement,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'

export type ProbeSection = 'coordinates' | 'priors' | 'conflicts' | 'metadata'

const PROBE_SECTION: Readonly<Record<ProbeId, ProbeSection>> = {
	gps: 'coordinates',
	network_geo: 'coordinates',
	ip_ipwho: 'coordinates',
	ip_geojs: 'coordinates',
	webrtc_stun: 'coordinates',
	storage_echo: 'coordinates',
	ip_cloudflare: 'priors',
	timezone: 'priors',
	locale: 'priors',
	rtt_probe: 'priors',
	intl_currency: 'priors',
	intl_calendar: 'priors',
	font_locale: 'priors',
	keyboard_layout: 'priors',
	referrer_tld: 'priors',
	tz_offset_conflict: 'conflicts',
	ip_vs_tz: 'conflicts',
	compass: 'metadata',
	network_info: 'metadata',
	permission_state: 'metadata',
}

const SECTION_ORDER: Readonly<Record<ProbeSection, number>> = {
	coordinates: 0,
	priors: 1,
	conflicts: 2,
	metadata: 3,
}

export const SECTION_LABELS: Readonly<Record<ProbeSection, string>> = {
	coordinates: 'Coordenadas',
	priors: 'Priors regionais',
	conflicts: 'Conflitos',
	metadata: 'Metadados',
}

export const ALL_PROBE_IDS = [
	'gps',
	'network_geo',
	'ip_cloudflare',
	'ip_ipwho',
	'ip_geojs',
	'timezone',
	'locale',
	'webrtc_stun',
	'rtt_probe',
	'intl_currency',
	'intl_calendar',
	'font_locale',
	'keyboard_layout',
	'compass',
	'tz_offset_conflict',
	'ip_vs_tz',
	'referrer_tld',
	'storage_echo',
	'network_info',
	'permission_state',
] as const satisfies readonly ProbeId[]

export const PROBE_FULL_LABELS = {
	gps: 'GPS / GNSS',
	network_geo: 'Wi‑Fi / celular (via navegador)',
	ip_cloudflare: 'IP (Cloudflare edge)',
	ip_ipwho: 'IP (ipwho.is)',
	ip_geojs: 'IP (geojs.io)',
	timezone: 'Fuso horário (IANA)',
	locale: 'Idioma / locale',
	webrtc_stun: 'WebRTC ICE / STUN',
	rtt_probe: 'Triangulação por latência (RTT)',
	intl_currency: 'Moeda / sistema numérico',
	intl_calendar: 'Sistema de calendário',
	font_locale: 'Fontes regionais instaladas',
	keyboard_layout: 'Layout de teclado',
	compass: 'Bússola / orientação',
	tz_offset_conflict: 'Relógio vs fuso IANA',
	ip_vs_tz: 'Conflito IP × fuso × locale',
	referrer_tld: 'Referrer / TLD de origem',
	storage_echo: 'Eco da sessão (GPS anterior)',
	network_info: 'Tipo de conexão',
	permission_state: 'Estado da permissão',
} as const satisfies Record<ProbeId, string>

export function agreementLabel(agreement: Agreement): string {
	switch (agreement) {
		case 'aligned':
			return 'Alinhado'
		case 'conflicted':
			return 'Em conflito'
		case 'sparse':
			return 'Esparso'
	}
}

export function agreementToneClass(agreement: Agreement): string {
	switch (agreement) {
		case 'aligned':
			return 'text-[var(--loc-accent)]'
		case 'conflicted':
			return 'text-rose-400'
		case 'sparse':
			return 'text-amber-300'
	}
}

export function probeSection(id: ProbeId): ProbeSection {
	return PROBE_SECTION[id]
}

export function sortSignalsForPanel(
	signals: readonly LocationSignal[],
): readonly LocationSignal[] {
	return [...signals].sort((left, right) => {
		const leftBlocked = left.status === 'denied' ? 1 : 0
		const rightBlocked = right.status === 'denied' ? 1 : 0
		if (leftBlocked !== rightBlocked) {
			return leftBlocked - rightBlocked
		}
		const sectionDelta =
			SECTION_ORDER[probeSection(left.id)] -
			SECTION_ORDER[probeSection(right.id)]
		if (sectionDelta !== 0) {
			return sectionDelta
		}
		return ALL_PROBE_IDS.indexOf(left.id) - ALL_PROBE_IDS.indexOf(right.id)
	})
}

export function groupSignalsBySection(
	signals: readonly LocationSignal[],
): readonly {
	readonly section: ProbeSection
	readonly signals: readonly LocationSignal[]
}[] {
	const ordered = sortSignalsForPanel(signals)
	const buckets: Record<ProbeSection, LocationSignal[]> = {
		coordinates: [],
		priors: [],
		conflicts: [],
		metadata: [],
	}
	for (const signal of ordered) {
		if (signal.status === 'denied') {
			continue
		}
		buckets[probeSection(signal.id)].push(signal)
	}
	const denied = ordered.filter(signal => signal.status === 'denied')
	const groups: {
		readonly section: ProbeSection
		readonly signals: readonly LocationSignal[]
	}[] = []
	for (const section of [
		'coordinates',
		'priors',
		'conflicts',
		'metadata',
	] as const) {
		const items = buckets[section]
		if (items.length > 0) {
			groups.push({ section, signals: items })
		}
	}
	if (denied.length > 0) {
		groups.push({ section: 'metadata', signals: denied })
	}
	return groups
}

export function collectingPlaceholderSignals(): readonly LocationSignal[] {
	const collectedAt = new Date(0).toISOString()
	return ALL_PROBE_IDS.map(id => ({
		id,
		label: PROBE_FULL_LABELS[id],
		status: 'ok' as const,
		confidence: 0,
		summary: 'Coletando…',
		raw: { placeholder: true },
		collectedAt,
	}))
}
