import type {
	Agreement,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'

export type ProbeSection = 'coordinates' | 'priors' | 'conflicts' | 'metadata'

export type PanelGroupKey = ProbeSection | 'denied'

const PROBE_SECTION: Readonly<Record<ProbeId, ProbeSection>> = {
	gps: 'coordinates',
	network_geo: 'coordinates',
	ip_ipwho: 'coordinates',
	ip_geojs: 'coordinates',
	webrtc_stun: 'coordinates',
	edge_geo: 'coordinates',
	storage_echo: 'coordinates',
	rtt_probe: 'coordinates',
	ip_cloudflare: 'priors',
	timezone: 'priors',
	locale: 'priors',
	intl_currency: 'priors',
	intl_calendar: 'priors',
	font_locale: 'priors',
	keyboard_layout: 'priors',
	referrer_tld: 'priors',
	color_scheme_solar: 'priors',
	date_string_tz: 'priors',
	worker_intl: 'priors',
	accept_language: 'priors',
	speech_voices: 'priors',
	iframe_intl: 'priors',
	service_worker_intl: 'priors',
	magnetometer: 'conflicts',
	tz_offset_conflict: 'conflicts',
	ip_vs_tz: 'conflicts',
	ip_sanity: 'conflicts',
	storage_gps_conflict: 'conflicts',
	compass: 'metadata',
	orientation_leak: 'metadata',
	barometer: 'metadata',
	clock_skew: 'metadata',
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

export const PANEL_GROUP_LABELS: Readonly<Record<PanelGroupKey, string>> = {
	coordinates: 'Coordenadas',
	priors: 'Priors regionais',
	conflicts: 'Conflitos',
	metadata: 'Metadados',
	denied: 'Negados',
}

export const DEFAULT_OPEN_PANEL_GROUPS: readonly PanelGroupKey[] = [
	'coordinates',
]

export const COLLECT_ERROR_MESSAGE = 'Falha ao coletar sinais.'

export function revealCtaLabel(input: {
	readonly isCollecting: boolean
	readonly isError: boolean
	readonly hasStarted: boolean
}): string {
	if (input.isCollecting) {
		return 'Coletando sinais…'
	}
	if (input.isError) {
		return 'Tentar de novo'
	}
	if (input.hasStarted) {
		return 'Coletar de novo'
	}
	return 'Revelar origem'
}

export const ALL_PROBE_IDS = [
	'gps',
	'network_geo',
	'ip_cloudflare',
	'ip_ipwho',
	'ip_geojs',
	'edge_geo',
	'timezone',
	'locale',
	'webrtc_stun',
	'rtt_probe',
	'intl_currency',
	'intl_calendar',
	'font_locale',
	'keyboard_layout',
	'compass',
	'orientation_leak',
	'magnetometer',
	'barometer',
	'color_scheme_solar',
	'clock_skew',
	'date_string_tz',
	'worker_intl',
	'accept_language',
	'speech_voices',
	'iframe_intl',
	'service_worker_intl',
	'tz_offset_conflict',
	'ip_vs_tz',
	'ip_sanity',
	'storage_gps_conflict',
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
	edge_geo: 'Edge geo (Vercel / servidor)',
	timezone: 'Fuso horário (IANA)',
	locale: 'Idioma / locale',
	webrtc_stun: 'WebRTC ICE / STUN',
	rtt_probe: 'Triangulação por latência (RTT)',
	intl_currency: 'Moeda / sistema numérico',
	intl_calendar: 'Sistema de calendário',
	font_locale: 'Fontes regionais instaladas',
	keyboard_layout: 'Layout de teclado',
	compass: 'Bússola / orientação',
	orientation_leak: 'Orientação legada (deviceorientation)',
	magnetometer: 'Campo geomagnético (WMM)',
	barometer: 'Barômetro / pressão',
	color_scheme_solar: 'Tema vs dia solar',
	clock_skew: 'Deriva do relógio',
	date_string_tz: 'Date#toString / fuso do motor',
	worker_intl: 'Worker Intl / idioma',
	accept_language: 'Accept-Language (cabeçalho HTTP)',
	speech_voices: 'Vozes de síntese (speechSynthesis)',
	iframe_intl: 'Iframe Intl / idioma',
	service_worker_intl: 'Service Worker Intl / idioma',
	tz_offset_conflict: 'Relógio vs fuso IANA',
	ip_vs_tz: 'Conflito IP × fuso × locale',
	ip_sanity: 'Sanidade de IP (TEST-NET / doc)',
	storage_gps_conflict: 'Conflito GPS sessão × atual',
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
			return 'text-[var(--loc-ok)]'
		case 'conflicted':
			return 'text-[var(--loc-danger)]'
		case 'sparse':
			return 'text-[var(--loc-warning)]'
	}
}

export function agreementChipClass(agreement: Agreement): string {
	switch (agreement) {
		case 'aligned':
			return 'border-[color-mix(in_oklab,var(--loc-ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--loc-ok)_12%,transparent)] text-[var(--loc-ok)]'
		case 'conflicted':
			return 'border-[color-mix(in_oklab,var(--loc-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--loc-danger)_12%,transparent)] text-[var(--loc-danger)]'
		case 'sparse':
			return 'border-[color-mix(in_oklab,var(--loc-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--loc-warning)_12%,transparent)] text-[var(--loc-warning)]'
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
	readonly key: PanelGroupKey
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
		readonly key: PanelGroupKey
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
			groups.push({ key: section, section, signals: items })
		}
	}
	if (denied.length > 0) {
		groups.push({ key: 'denied', section: 'metadata', signals: denied })
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
