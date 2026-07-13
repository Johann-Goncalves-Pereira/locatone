import { Either, Schema } from 'effect'

import { TodoFilter } from '@features/todos/api/todos.schema'

export const TodosSearch = Schema.Struct({
	filter: Schema.optionalWith(TodoFilter, {
		default: () => 'all' satisfies TodoFilter,
	}),
})
export type TodosSearch = typeof TodosSearch.Type

const defaultSearch = { filter: 'all' } satisfies TodosSearch

/** Soft-decode URL search; invalid values fall back to `{ filter: 'all' }`. */
export function parseTodosSearch(search: unknown): TodosSearch {
	return Either.getOrElse(
		Schema.decodeUnknownEither(TodosSearch)(search),
		() => defaultSearch,
	)
}
