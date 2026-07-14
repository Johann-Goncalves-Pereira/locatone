import { Effect, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { ApiError, runApiPromise } from '@lib/api-client'

import {
	ClientHeadersResponse,
	type ClientHeadersResponse as ClientHeadersResponseType,
} from '@features/location/api/location.schema'

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
 * Same-origin `/api/client-headers` — echoes Accept-Language.
 * Must NOT go through VITE_API_BASE_URL.
 */
export const fetchClientHeadersEffect = (
	signal?: AbortSignal,
): Effect.Effect<ClientHeadersResponseType, ApiError | ParseError> =>
	Effect.gen(function* () {
		const init: RequestInit = {
			method: 'GET',
			headers: { Accept: 'application/json' },
		}
		if (signal !== undefined) {
			init.signal = signal
		}

		const response = yield* Effect.tryPromise({
			try: () => fetch('/api/client-headers', init),
			catch: toNetworkError,
		})

		if (response.status === 404) {
			return {
				available: false,
				reason: 'missing_endpoint',
			} satisfies ClientHeadersResponseType
		}

		if (!response.ok) {
			return yield* new ApiError({
				message: `client-headers failed: ${response.statusText}`,
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
			try: () => (text ? JSON.parse(text) : null),
			catch: cause =>
				new ApiError({
					message: cause instanceof Error ? cause.message : String(cause),
					status: response.status,
				}),
		})

		return yield* Schema.decodeUnknown(ClientHeadersResponse)(data)
	})

export const fetchClientHeadersPromise = (
	signal?: AbortSignal,
): Promise<ClientHeadersResponseType> =>
	runApiPromise(fetchClientHeadersEffect(signal))
