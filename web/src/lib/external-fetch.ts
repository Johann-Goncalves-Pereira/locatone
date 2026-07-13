import { Effect, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { ApiError, runApiPromise } from '@lib/api-client'

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

function assertHttpsAbsolute(url: string): Effect.Effect<string, ApiError> {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return Effect.fail(
			new ApiError({
				message: 'Invalid absolute URL',
				status: 0,
			}),
		)
	}

	if (parsed.protocol !== 'https:') {
		return Effect.fail(
			new ApiError({
				message: 'Only https absolute URLs are allowed',
				status: 0,
			}),
		)
	}

	return Effect.succeed(parsed.href)
}

function parseJson(text: string): unknown {
	if (!text) {
		return null
	}

	const result: unknown = JSON.parse(text)
	return result
}

/**
 * GET an absolute HTTPS URL and decode JSON with Effect Schema.
 * Use only for third-party public APIs (IP geo, etc.).
 */
export const externalGetJson = <A, I>(
	url: string,
	schema: Schema.Schema<A, I>,
	options: { readonly signal?: AbortSignal } = {},
): Effect.Effect<A, ApiError | ParseError> =>
	Effect.gen(function* () {
		const href = yield* assertHttpsAbsolute(url)
		const init: RequestInit = {
			method: 'GET',
			headers: { Accept: 'application/json' },
		}
		if (options.signal !== undefined) {
			init.signal = options.signal
		}

		const response = yield* Effect.tryPromise({
			try: () => fetch(href, init),
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

/**
 * GET an absolute HTTPS URL as plain text (e.g. Cloudflare trace).
 */
export const externalGetText = (
	url: string,
	options: { readonly signal?: AbortSignal } = {},
): Effect.Effect<string, ApiError> =>
	Effect.gen(function* () {
		const href = yield* assertHttpsAbsolute(url)
		const init: RequestInit = {
			method: 'GET',
			headers: { Accept: 'text/plain' },
		}
		if (options.signal !== undefined) {
			init.signal = options.signal
		}

		const response = yield* Effect.tryPromise({
			try: () => fetch(href, init),
			catch: toNetworkError,
		})

		if (!response.ok) {
			return yield* new ApiError({
				message: `Request failed: ${response.statusText}`,
				status: response.status,
			})
		}

		return yield* Effect.tryPromise({
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
	})

export const externalGetJsonPromise = <A, I>(
	url: string,
	schema: Schema.Schema<A, I>,
	signal?: AbortSignal,
): Promise<A> =>
	runApiPromise(
		externalGetJson(url, schema, signal === undefined ? {} : { signal }),
	)

export const externalGetTextPromise = (
	url: string,
	signal?: AbortSignal,
): Promise<string> =>
	runApiPromise(externalGetText(url, signal === undefined ? {} : { signal }))
