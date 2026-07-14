import { Schema } from 'effect'

const Env = Schema.Struct({
	MODE: Schema.Literal('development', 'production', 'test'),
	DEV: Schema.Boolean,
	PROD: Schema.Boolean,
	SSR: Schema.Boolean,
	VITE_API_BASE_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://ipwho.is'),
	}),
	VITE_IPWHO_BASE: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://ipwho.is/'),
	}),
	VITE_GEOJS_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://get.geojs.io/v1/ip/geo.json'),
	}),
	VITE_CLOUDFLARE_TRACE_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://www.cloudflare.com/cdn-cgi/trace'),
	}),
	VITE_SEEIP_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://api.seeip.org/geoip'),
	}),
	VITE_GEOIPLOOKUP_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://json.geoiplookup.io/'),
	}),
	VITE_STUN_URL: Schema.optionalWith(Schema.String, {
		default: () => 'stun:stun.l.google.com:19302',
	}),
})

export const env = Schema.decodeUnknownSync(Env)(import.meta.env)
