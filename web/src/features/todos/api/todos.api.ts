import type { Effect } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import { type ApiError, apiGet, runApiPromise } from '@lib/api-client'

import {
	Todos,
	type Todos as TodosType,
} from '@features/todos/api/todos.schema'

export const fetchTodos = (
	signal?: AbortSignal,
): Effect.Effect<TodosType, ApiError | ParseError> =>
	apiGet('/todos', Todos, signal === undefined ? {} : { signal })

export const fetchTodosPromise = (signal?: AbortSignal): Promise<TodosType> =>
	runApiPromise(fetchTodos(signal))
