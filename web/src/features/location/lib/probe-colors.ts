import type { ProbeId } from '@features/location/api/location.schema'

export const FUSED_COLOR = '#3EE0C0'

export const PROBE_COLORS = {
	gps: '#3EE0C0',
	network_geo: '#22D3EE',
	ip_cloudflare: '#34D399',
	ip_ipwho: '#10B981',
	ip_geojs: '#059669',
	edge_geo: '#14B8A6',
	timezone: '#A855F7',
	locale: '#8B5CF6',
	webrtc_stun: '#84CC16',
	rtt_probe: '#F59E0B',
	intl_currency: '#EC4899',
	intl_calendar: '#D946EF',
	font_locale: '#F97316',
	keyboard_layout: '#EAB308',
	compass: '#94A3B8',
	orientation_leak: '#7DD3FC',
	magnetometer: '#C084FC',
	barometer: '#38BDF8',
	color_scheme_solar: '#FBBF24',
	clock_skew: '#A1A1AA',
	date_string_tz: '#C4B5FD',
	worker_intl: '#A78BFA',
	tz_offset_conflict: '#FB7185',
	ip_vs_tz: '#F43F5E',
	ip_sanity: '#E11D48',
	storage_gps_conflict: '#BE123C',
	referrer_tld: '#6366F1',
	storage_echo: '#64748B',
	network_info: '#78858D',
	permission_state: '#6B7280',
} as const satisfies Record<ProbeId, string>

export function probeColor(id: ProbeId): string {
	return PROBE_COLORS[id]
}

export const SHORT_PROBE_LABELS = {
	gps: 'GPS',
	network_geo: 'Rede',
	ip_cloudflare: 'IP CF',
	ip_ipwho: 'IP who',
	ip_geojs: 'IP geojs',
	edge_geo: 'Edge',
	timezone: 'Fuso',
	locale: 'Locale',
	webrtc_stun: 'STUN',
	rtt_probe: 'RTT',
	intl_currency: 'Moeda',
	intl_calendar: 'Calend.',
	font_locale: 'Fontes',
	keyboard_layout: 'Teclado',
	compass: 'Bússola',
	orientation_leak: 'Orient.',
	magnetometer: 'Mag.',
	barometer: 'Baro.',
	color_scheme_solar: 'Solar',
	clock_skew: 'Skew',
	date_string_tz: 'Date()',
	worker_intl: 'Worker',
	tz_offset_conflict: 'Offset',
	ip_vs_tz: 'IP×fuso',
	ip_sanity: 'IP sanity',
	storage_gps_conflict: 'Sessão×GPS',
	referrer_tld: 'Referrer',
	storage_echo: 'Sessão',
	network_info: 'Conexão',
	permission_state: 'Permissão',
} as const satisfies Record<ProbeId, string>

export function shortProbeLabel(id: ProbeId): string {
	return SHORT_PROBE_LABELS[id]
}
