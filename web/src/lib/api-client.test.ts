import { Effect, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	ApiError,
	apiDelete,
	apiGet,
	apiPost,
	runApiPromise,
} from '@lib/api-client'

const Item = Schema.Struct({
	id: Schema.Number,
	title: Schema.String,
})

const CreateItem = Schema.Struct({
	title: Schema.String,
})

describe('api-client', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it('decodes a successful GET response', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: 1, title: 'Write tests' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		)
		vi.stubGlobal('fetch', fetchMock)

		const result = await Effect.runPromise(apiGet('/todos/1', Item))

		expect(result).toEqual({ id: 1, title: 'Write tests' })
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringMatching(/\/todos\/1$/),
			expect.objectContaining({ method: 'GET' }),
		)
	})

	it('rejects absolute URLs', async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)

		const result = await Effect.runPromise(
			Effect.either(apiGet('https://evil.example/todos', Item)),
		)

		expect(result._tag).toBe('Left')
		if (result._tag === 'Left') {
			expect(result.left).toBeInstanceOf(ApiError)
			expect(result.left.message).toMatch(/Absolute URLs/)
		}
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('maps HTTP errors to ApiError', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response('Nope', { status: 500, statusText: 'Server Error' }),
				),
		)

		const result = await Effect.runPromise(
			Effect.either(apiGet('/todos', Item)),
		)

		expect(result._tag).toBe('Left')
		if (result._tag === 'Left') {
			expect(result.left).toBeInstanceOf(ApiError)
			if (result.left instanceof ApiError) {
				expect(result.left.status).toBe(500)
			}
		}
	})

	it('fails when the response does not match the schema', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ id: 'bad', title: 1 }), {
					status: 200,
				}),
			),
		)

		const result = await Effect.runPromise(
			Effect.either(apiGet('/todos/1', Item)),
		)

		expect(result._tag).toBe('Left')
	})

	it('forwards AbortSignal and rethrows AbortError for Query cancel', async () => {
		const controller = new AbortController()
		controller.abort()

		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
				if (init?.signal?.aborted) {
					return Promise.reject(new DOMException('Aborted', 'AbortError'))
				}
				return Promise.resolve(new Response('{}', { status: 200 }))
			}),
		)

		await expect(
			runApiPromise(apiGet('/todos', Item, { signal: controller.signal })),
		).rejects.toMatchObject({ name: 'AbortError' })
	})

	it('encodes JSON bodies for POST requests', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: 2, title: 'Created' }), {
				status: 201,
			}),
		)
		vi.stubGlobal('fetch', fetchMock)

		const result = await Effect.runPromise(
			apiPost('/todos', Item, CreateItem, { title: 'Created' }),
		)

		expect(result).toEqual({ id: 2, title: 'Created' })
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringMatching(/\/todos$/),
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ title: 'Created' }),
			}),
		)
	})

	it('decodes empty DELETE responses with Schema.Null', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
			statusText: 'No Content',
			text: () => Promise.resolve(''),
		})
		vi.stubGlobal('fetch', fetchMock)

		const result = await Effect.runPromise(apiDelete('/todos/1', Schema.Null))

		expect(result).toBeNull()
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringMatching(/\/todos\/1$/),
			expect.objectContaining({ method: 'DELETE' }),
		)
	})
})
