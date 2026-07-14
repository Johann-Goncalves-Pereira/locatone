import { Schema } from 'effect'

export const ProbeId = Schema.Literal(
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
	'magnetometer',
	'barometer',
	'color_scheme_solar',
	'clock_skew',
	'tz_offset_conflict',
	'ip_vs_tz',
	'referrer_tld',
	'storage_echo',
	'network_info',
	'permission_state',
)
export type ProbeId = typeof ProbeId.Type

export const SignalStatus = Schema.Literal(
	'ok',
	'denied',
	'unsupported',
	'error',
)
export type SignalStatus = typeof SignalStatus.Type

export const RegionHints = Schema.Struct({
	countryCodes: Schema.optional(Schema.Array(Schema.String)),
	countries: Schema.optional(Schema.Array(Schema.String)),
	cities: Schema.optional(Schema.Array(Schema.String)),
	regions: Schema.optional(Schema.Array(Schema.String)),
	timezone: Schema.optional(Schema.String),
	languages: Schema.optional(Schema.Array(Schema.String)),
})
export type RegionHints = typeof RegionHints.Type

export const LocationSignal = Schema.Struct({
	id: ProbeId,
	label: Schema.String,
	status: SignalStatus,
	confidence: Schema.Number.pipe(Schema.between(0, 1)),
	lat: Schema.optional(Schema.Number),
	lng: Schema.optional(Schema.Number),
	accuracyMeters: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
	regionHints: Schema.optional(RegionHints),
	raw: Schema.Unknown,
	collectedAt: Schema.String,
	summary: Schema.String,
})
export type LocationSignal = typeof LocationSignal.Type

export const Agreement = Schema.Literal('aligned', 'conflicted', 'sparse')
export type Agreement = typeof Agreement.Type

export const FusedLocation = Schema.Struct({
	lat: Schema.optional(Schema.Number),
	lng: Schema.optional(Schema.Number),
	accuracyMeters: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
	agreement: Agreement,
	summary: Schema.String,
	confidence: Schema.Number.pipe(Schema.between(0, 1)),
	sourceIds: Schema.Array(ProbeId),
})
export type FusedLocation = typeof FusedLocation.Type

export const PanelState = Schema.Literal('open', 'closed')
export type PanelState = typeof PanelState.Type

export const IpWhoResponse = Schema.Struct({
	success: Schema.Boolean,
	ip: Schema.optional(Schema.String),
	type: Schema.optional(Schema.String),
	continent: Schema.optional(Schema.String),
	continent_code: Schema.optional(Schema.String),
	country: Schema.optional(Schema.String),
	country_code: Schema.optional(Schema.String),
	region: Schema.optional(Schema.String),
	region_code: Schema.optional(Schema.String),
	city: Schema.optional(Schema.String),
	latitude: Schema.optional(Schema.Number),
	longitude: Schema.optional(Schema.Number),
	timezone: Schema.optional(
		Schema.Struct({
			id: Schema.optional(Schema.String),
			abbr: Schema.optional(Schema.String),
			utc: Schema.optional(Schema.String),
		}),
	),
	connection: Schema.optional(
		Schema.Struct({
			isp: Schema.optional(Schema.String),
			org: Schema.optional(Schema.String),
		}),
	),
	message: Schema.optional(Schema.String),
})
export type IpWhoResponse = typeof IpWhoResponse.Type

export const CloudflareTrace = Schema.Struct({
	ip: Schema.optional(Schema.String),
	loc: Schema.optional(Schema.String),
	colo: Schema.optional(Schema.String),
	uag: Schema.optional(Schema.String),
	tls: Schema.optional(Schema.String),
	http: Schema.optional(Schema.String),
})
export type CloudflareTrace = typeof CloudflareTrace.Type

export const GeoJsResponse = Schema.Struct({
	ip: Schema.optional(Schema.String),
	country: Schema.optional(Schema.String),
	country_code: Schema.optional(Schema.String),
	city: Schema.optional(Schema.String),
	region: Schema.optional(Schema.String),
	latitude: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
	longitude: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
	timezone: Schema.optional(Schema.String),
	organization_name: Schema.optional(Schema.String),
})
export type GeoJsResponse = typeof GeoJsResponse.Type

export const StoredCoordinates = Schema.Struct({
	lat: Schema.Number,
	lng: Schema.Number,
	accuracyMeters: Schema.optional(Schema.Number),
	savedAt: Schema.String,
})
export type StoredCoordinates = typeof StoredCoordinates.Type
