import { describe, expect, it } from 'vitest'

import { parseTodosSearch } from '@features/todos/api/todos.search'

describe('parseTodosSearch', () => {
	it('defaults missing filter to all', () => {
		expect(parseTodosSearch({})).toEqual({ filter: 'all' })
	})

	it('accepts valid filters', () => {
		expect(parseTodosSearch({ filter: 'active' })).toEqual({
			filter: 'active',
		})
		expect(parseTodosSearch({ filter: 'done' })).toEqual({ filter: 'done' })
	})

	it('falls back to all for invalid filter values', () => {
		expect(parseTodosSearch({ filter: 'nope' })).toEqual({ filter: 'all' })
		expect(parseTodosSearch({ filter: 1 })).toEqual({ filter: 'all' })
	})
})
