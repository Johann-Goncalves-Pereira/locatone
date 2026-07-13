import type { Todo } from '@features/todos/api/todos.schema'
import type { ListDensity } from '@features/todos/atoms/todos-ui.atom'

const DISPLAY_LIMIT = 10

interface TodoListProps {
	todos: readonly Todo[] | undefined
	isLoading: boolean
	isError: boolean
	errorMessage?: string | undefined
	density?: ListDensity
}

export function TodoList({
	todos,
	isLoading,
	isError,
	errorMessage = 'Failed to load todos.',
	density = 'comfortable',
}: TodoListProps) {
	if (isLoading) {
		return (
			<p
				className='text-sm text-stone-500 dark:text-stone-400'
				role='status'
				aria-live='polite'
			>
				Loading todos...
			</p>
		)
	}

	if (isError) {
		return (
			<p
				className='text-sm text-red-600 dark:text-red-400'
				role='alert'
				aria-live='assertive'
			>
				{errorMessage}
			</p>
		)
	}

	if (todos === undefined || todos.length === 0) {
		return (
			<p className='text-sm text-stone-500 dark:text-stone-400'>
				No todos match this filter.
			</p>
		)
	}

	const visibleTodos = todos.slice(0, DISPLAY_LIMIT)
	const itemPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
	const truncated = todos.length > DISPLAY_LIMIT

	return (
		<div className='space-y-3'>
			<p className='text-sm text-stone-500 dark:text-stone-400'>
				{truncated
					? `Showing first ${String(visibleTodos.length)} of ${String(todos.length)}`
					: `Showing ${String(visibleTodos.length)} of ${String(todos.length)}`}
			</p>
			<ul className='divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900'>
				{visibleTodos.map(todo => (
					<li
						key={todo.id}
						className={`flex items-start gap-3 text-sm text-stone-800 dark:text-stone-100 ${itemPadding}`}
					>
						<span
							className={`mt-1 size-2 shrink-0 rounded-full ${todo.completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
							aria-hidden='true'
						/>
						<div className='space-y-1'>
							<p className='font-medium'>{todo.title}</p>
							<p className='text-xs text-stone-500 dark:text-stone-400'>
								<span className='sr-only'>
									{todo.completed ? 'Completed. ' : 'Active. '}
								</span>
								User #{todo.userId}
							</p>
						</div>
					</li>
				))}
			</ul>
		</div>
	)
}
