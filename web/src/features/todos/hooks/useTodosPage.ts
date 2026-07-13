import { useTodosQuery } from '@features/todos/api/todos.queries'
import type { TodoFilter } from '@features/todos/api/todos.schema'

function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message
	}

	return 'Failed to load todos.'
}

export function useTodosPage(filter: TodoFilter) {
	const { data, isLoading, isError, error } = useTodosQuery(filter)

	return {
		filter,
		todos: data,
		isLoading,
		isError,
		errorMessage: isError ? errorMessage(error) : undefined,
	}
}
