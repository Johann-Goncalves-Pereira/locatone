import { Effect, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { ApiError, runApiPromise } from '@lib/api-client'
import { env } from '@lib/env'
import { externalGetJson, externalGetText } from '@lib/external-fetch'

import {
	CloudflareTrace,
	type CloudflareTrace as CloudflareTraceType,
	IpWhoResponse,
	type IpWhoResponse as IpWhoResponseType,
} from '@features/location/api/location.schema'

export function parseCloudflareTrace(text: string): CloudflareTraceType {
	const entries: Record<string, string> = {}
	for (const line of text.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed) {
			continue
		}
		const separatorIndex = trimmed.indexOf('=')
		if (separatorIndex <= 0) {
			continue
		}
		const key = trimmed.slice(0, separatorIndex)
		const value = trimmed.slice(separatorIndex + 1)
		entries[key] = value
	}

	return Schema.decodeUnknownSync(CloudflareTrace)(entries)
}

export const fetchCloudflareTrace = (
	signal?: AbortSignal,
): Effect.Effect<CloudflareTraceType, ApiError | ParseError> =>
	Effect.gen(function* () {
		const text = yield* externalGetText(
			env.VITE_CLOUDFLARE_TRACE_URL.href,
			signal === undefined ? {} : { signal },
		)
		return yield* Effect.try({
			try: () => parseCloudflareTrace(text),
			catch: cause =>
				new ApiError({
					message:
						cause instanceof Error
							? cause.message
							: 'Failed to parse Cloudflare trace',
					status: 0,
				}),
		})
	})

export const fetchIpWho = (
	ip?: string,
	signal?: AbortSignal,
): Effect.Effect<IpWhoResponseType, ApiError | ParseError> => {
	const base = env.VITE_IPWHO_BASE.href.replace(/\/$/, '')
	const path =
		ip === undefined || ip.length === 0 ? `${base}/` : `${base}/${ip}`
	return externalGetJson(
		path,
		IpWhoResponse,
		signal === undefined ? {} : { signal },
	)
}

export const fetchCloudflareTracePromise = (
	signal?: AbortSignal,
): Promise<CloudflareTraceType> => runApiPromise(fetchCloudflareTrace(signal))

export const fetchIpWhoPromise = (
	ip?: string,
	signal?: AbortSignal,
): Promise<IpWhoResponseType> => runApiPromise(fetchIpWho(ip, signal))
