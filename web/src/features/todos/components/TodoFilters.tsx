import type { TodoFilter } from '@features/todos/api/todos.schema'

import { Button } from '@components/ui/Button'

const filters = [
	{ value: 'all', label: 'All' },
	{ value: 'active', label: 'Active' },
	{ value: 'done', label: 'Done' },
] as const satisfies readonly { value: TodoFilter; label: string }[]

interface TodoFiltersProps {
	filter: TodoFilter
	onFilterChange: (filter: TodoFilter) => void
}

export function TodoFilters({ filter, onFilterChange }: TodoFiltersProps) {
	return (
		<div
			className='flex flex-wrap gap-2'
			role='group'
			aria-label='Todo filters'
		>
			{filters.map(option => (
				<Button
					key={option.value}
					variant={filter === option.value ? 'primary' : 'ghost'}
					aria-pressed={filter === option.value}
					onClick={() => {
						onFilterChange(option.value)
					}}
				>
					{option.label}
				</Button>
			))}
		</div>
	)
}
