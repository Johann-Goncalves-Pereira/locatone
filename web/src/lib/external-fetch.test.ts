import { Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@lib/api-client'
import { externalGetJson, externalGetText } from '@lib/external-fetch'

describe('external-fetch', () => {
	it('rejects non-https absolute URLs', async () => {
		const result = await Effect.runPromise(
			Effect.either(externalGetText('http://example.com/trace')),
		)

		expect(result._tag).toBe('Left')
		if (result._tag === 'Left') {
			expect(result.left).toBeInstanceOf(ApiError)
		}
	})

	it('rejects relative paths', async () => {
		const Item = Schema.Struct({ ok: Schema.Boolean })
		const result = await Effect.runPromise(
			Effect.either(externalGetJson('/relative', Item)),
		)

		expect(result._tag).toBe('Left')
	})
})
