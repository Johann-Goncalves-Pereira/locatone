import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { Todo, TodoFilter, Todos } from '@features/todos/api/todos.schema'

describe('todos.schema', () => {
	it('parses a valid todo', () => {
		const todo = Schema.decodeUnknownSync(Todo)({
			id: 1,
			userId: 1,
			title: 'Ship typed boilerplate',
			completed: false,
		})

		expect(todo.title).toBe('Ship typed boilerplate')
	})

	it('rejects invalid todo payloads', () => {
		expect(() =>
			Schema.decodeUnknownSync(Todo)({
				id: '1',
				userId: 1,
				title: '',
				completed: false,
			}),
		).toThrow()
	})

	it('parses todo collections', () => {
		const todos = Schema.decodeUnknownSync(Todos)([
			{
				id: 1,
				userId: 1,
				title: 'First',
				completed: true,
			},
		])

		expect(todos).toHaveLength(1)
	})

	it('parses filter values', () => {
		expect(Schema.decodeUnknownSync(TodoFilter)('active')).toBe('active')
	})
})
