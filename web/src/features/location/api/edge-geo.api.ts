import { Effect, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { ApiError, runApiPromise } from '@lib/api-client'

import {
	EdgeGeoResponse,
	type EdgeGeoResponse as EdgeGeoResponseType,
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
 * Same-origin `/api/edge-geo` — must NOT go through VITE_API_BASE_URL
 * (that points at public IP APIs).
 */
export const fetchEdgeGeoEffect = (
	signal?: AbortSignal,
): Effect.Effect<EdgeGeoResponseType, ApiError | ParseError> =>
	Effect.gen(function* () {
		const init: RequestInit = {
			method: 'GET',
			headers: { Accept: 'application/json' },
		}
		if (signal !== undefined) {
			init.signal = signal
		}

		const response = yield* Effect.tryPromise({
			try: () => fetch('/api/edge-geo', init),
			catch: toNetworkError,
		})

		if (response.status === 404) {
			return {
				available: false,
				reason: 'missing_endpoint',
			} satisfies EdgeGeoResponseType
		}

		if (!response.ok) {
			return yield* new ApiError({
				message: `edge-geo failed: ${response.statusText}`,
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

		return yield* Schema.decodeUnknown(EdgeGeoResponse)(data)
	})

export const fetchEdgeGeoPromise = (
	signal?: AbortSignal,
): Promise<EdgeGeoResponseType> => runApiPromise(fetchEdgeGeoEffect(signal))
