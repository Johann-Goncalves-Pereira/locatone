import { describe, expect, it } from 'vitest'

import { todosQueryOptions } from '@features/todos/api/todos.queries'
import { todoKeys } from '@features/todos/api/todos.query-keys'

describe('todosQueryOptions', () => {
	it('uses a stable list query key across filters', () => {
		const allOptions = todosQueryOptions('all')
		const activeOptions = todosQueryOptions('active')
		const doneOptions = todosQueryOptions('done')

		expect(allOptions.queryKey).toEqual(todoKeys.list())
		expect(activeOptions.queryKey).toEqual(todoKeys.list())
		expect(doneOptions.queryKey).toEqual(todoKeys.list())
		expect(allOptions.queryKey).toEqual(activeOptions.queryKey)
	})

	it('filters todos in select without changing the query key', () => {
		const todos = [
			{
				id: 1,
				userId: 1,
				title: 'Active task',
				completed: false,
			},
			{
				id: 2,
				userId: 1,
				title: 'Done task',
				completed: true,
			},
		]

		const select = todosQueryOptions('active').select
		expect(select).toBeTypeOf('function')
		if (!select) {
			throw new Error('Expected select to be defined')
		}

		expect(select(todos)).toEqual([todos[0]])
		expect(todosQueryOptions('done').queryKey).toEqual(todoKeys.list())
	})
})
