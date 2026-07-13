import { Schema } from 'effect'

const Env = Schema.Struct({
	MODE: Schema.Literal('development', 'production', 'test'),
	DEV: Schema.Boolean,
	PROD: Schema.Boolean,
	SSR: Schema.Boolean,
	VITE_API_BASE_URL: Schema.optionalWith(Schema.URL, {
		default: () => new URL('https://jsonplaceholder.typicode.com'),
	}),
})

export const env = Schema.decodeUnknownSync(Env)(import.meta.env)
