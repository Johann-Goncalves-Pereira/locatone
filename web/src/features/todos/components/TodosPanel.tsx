import { useAtomSet, useAtomValue } from '@effect-atom/atom-react'

import type { TodoFilter } from '@features/todos/api/todos.schema'
import { listDensityAtom } from '@features/todos/atoms/todos-ui.atom'
import { TodoFilters } from '@features/todos/components/TodoFilters'
import { TodoList } from '@features/todos/components/TodoList'
import { useTodosPage } from '@features/todos/hooks/useTodosPage'

import { Button } from '@components/ui/Button'

interface TodosPanelProps {
	filter: TodoFilter
	onFilterChange: (filter: TodoFilter) => void
}

export function TodosPanel({ filter, onFilterChange }: TodosPanelProps) {
	const { todos, isLoading, isError, errorMessage } = useTodosPage(filter)
	const density = useAtomValue(listDensityAtom)
	const setDensity = useAtomSet(listDensityAtom)

	return (
		<section className='mx-auto flex w-full max-w-3xl flex-col gap-6 p-6'>
			<header className='space-y-2'>
				<p className='text-sm font-medium tracking-[0.2em] text-stone-500 uppercase dark:text-stone-400'>
					Feature example
				</p>
				<h1 className='text-3xl font-semibold tracking-tight'>
					Typed todos with Query + Effect
				</h1>
				<p className='max-w-2xl text-sm text-stone-600 dark:text-stone-300'>
					Server state comes from JSONPlaceholder with Effect Schema validation.
					The list filter lives in the URL search params (?filter=). List
					density is local UI state via Effect Atom.
				</p>
			</header>

			<div className='flex flex-wrap items-center justify-between gap-3'>
				<TodoFilters filter={filter} onFilterChange={onFilterChange} />
				<Button
					variant='ghost'
					aria-pressed={density === 'compact'}
					onClick={() => {
						setDensity(current =>
							current === 'comfortable' ? 'compact' : 'comfortable',
						)
					}}
				>
					{density === 'comfortable' ? 'Compact view' : 'Comfortable view'}
				</Button>
			</div>

			<TodoList
				todos={todos}
				isLoading={isLoading}
				isError={isError}
				errorMessage={errorMessage}
				density={density}
			/>
		</section>
	)
}
