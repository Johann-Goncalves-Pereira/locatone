import { Cause, Data, Effect, Exit, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { env } from '@lib/env'

export class ApiError extends Data.TaggedError('ApiError')<{
	readonly message: string
	readonly status: number
}> {}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiRequestOptions {
	readonly method?: HttpMethod
	readonly body?: unknown
	readonly signal?: AbortSignal
}

function isAbortError(cause: unknown): boolean {
	return (
		(cause instanceof DOMException && cause.name === 'AbortError') ||
		(cause instanceof Error && cause.name === 'AbortError')
	)
}

function toNetworkError(cause: unknown): ApiError {
	if (isAbortError(cause)) {
		throw cause
	}

	return new ApiError({
		message: cause instanceof Error ? cause.message : String(cause),
		status: 0,
	})
}

/**
 * Runs an API Effect as a Promise. AbortErrors are rethrown as DOM AbortError
 * so TanStack Query treats them as cancellation, not failure.
 */
export const runApiPromise = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromiseExit(effect).then(exit => {
		if (Exit.isSuccess(exit)) {
			return exit.value
		}

		const squashed = Cause.squash(exit.cause)
		if (isAbortError(squashed)) {
			throw squashed
		}

		throw squashed
	})

function resolveUrl(path: string): Effect.Effect<string, ApiError> {
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return Effect.fail(
			new ApiError({
				message:
					'Absolute URLs are not allowed; use a path relative to VITE_API_BASE_URL',
				status: 0,
			}),
		)
	}

	const base = env.VITE_API_BASE_URL.href.replace(/\/$/, '')
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return Effect.succeed(`${base}${normalizedPath}`)
}

function parseJson(text: string): unknown {
	if (!text) {
		return null
	}

	const result: unknown = JSON.parse(text)
	return result
}

function buildRequestInit(options: ApiRequestOptions): RequestInit {
	const method = options.method ?? 'GET'
	const headers: Record<string, string> = {
		Accept: 'application/json',
	}

	if (options.body !== undefined) {
		headers['Content-Type'] = 'application/json'
	}

	const init: RequestInit = {
		method,
		headers,
	}

	if (options.signal !== undefined) {
		init.signal = options.signal
	}

	if (options.body !== undefined) {
		init.body = JSON.stringify(options.body)
	}

	return init
}

export const apiRequest = <A, I>(
	path: string,
	schema: Schema.Schema<A, I>,
	options: ApiRequestOptions = {},
): Effect.Effect<A, ApiError | ParseError> =>
	Effect.gen(function* () {
		const url = yield* resolveUrl(path)
		const init = buildRequestInit(options)

		const response = yield* Effect.tryPromise({
			try: () => fetch(url, init),
			catch: toNetworkError,
		})

		if (!response.ok) {
			return yield* new ApiError({
				message: `Request failed: ${response.statusText}`,
				status: response.status,
			})
		}

		const text = yield* Effect.tryPromise({
			try: () => response.text(),
			catch: cause => {
				if (isAbortError(cause)) {
					throw cause
				}

				return new ApiError({
					message: cause instanceof Error ? cause.message : String(cause),
					status: response.status,
				})
			},
		})

		const data = yield* Effect.try({
			try: () => parseJson(text),
			catch: cause =>
				new ApiError({
					message: cause instanceof Error ? cause.message : String(cause),
					status: response.status,
				}),
		})

		return yield* Schema.decodeUnknown(schema)(data)
	})

export const apiGet = <A, I>(
	path: string,
	schema: Schema.Schema<A, I>,
	options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Effect.Effect<A, ApiError | ParseError> =>
	apiRequest(path, schema, { ...options, method: 'GET' })

export const apiPost = <A, I, B, BI>(
	path: string,
	responseSchema: Schema.Schema<A, I>,
	bodySchema: Schema.Schema<B, BI>,
	body: B,
	options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Effect.Effect<A, ApiError | ParseError> =>
	Effect.gen(function* () {
		const encoded = yield* Schema.encode(bodySchema)(body)
		return yield* apiRequest(path, responseSchema, {
			...options,
			method: 'POST',
			body: encoded,
		})
	})

export const apiPut = <A, I, B, BI>(
	path: string,
	responseSchema: Schema.Schema<A, I>,
	bodySchema: Schema.Schema<B, BI>,
	body: B,
	options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Effect.Effect<A, ApiError | ParseError> =>
	Effect.gen(function* () {
		const encoded = yield* Schema.encode(bodySchema)(body)
		return yield* apiRequest(path, responseSchema, {
			...options,
			method: 'PUT',
			body: encoded,
		})
	})

export const apiPatch = <A, I, B, BI>(
	path: string,
	responseSchema: Schema.Schema<A, I>,
	bodySchema: Schema.Schema<B, BI>,
	body: B,
	options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Effect.Effect<A, ApiError | ParseError> =>
	Effect.gen(function* () {
		const encoded = yield* Schema.encode(bodySchema)(body)
		return yield* apiRequest(path, responseSchema, {
			...options,
			method: 'PATCH',
			body: encoded,
		})
	})

/** DELETE with a JSON response body. For empty 204 responses, pass `Schema.Null`. */
export const apiDelete = <A, I>(
	path: string,
	schema: Schema.Schema<A, I>,
	options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
): Effect.Effect<A, ApiError | ParseError> =>
	apiRequest(path, schema, { ...options, method: 'DELETE' })
