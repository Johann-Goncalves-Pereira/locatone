import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TodoList } from '@features/todos/components/TodoList'

import { renderWithProviders } from '@/test/test-utils'

describe('TodoList', () => {
	it('renders todos returned by the query layer', () => {
		renderWithProviders(
			<TodoList
				isLoading={false}
				isError={false}
				todos={[
					{
						id: 1,
						userId: 7,
						title: 'Write tests',
						completed: false,
					},
				]}
			/>,
		)

		expect(screen.getByText('Write tests')).toBeInTheDocument()
		expect(screen.getByText('User #7')).toBeInTheDocument()
		expect(screen.getByText('Active.')).toBeInTheDocument()
		expect(screen.getByText('Showing 1 of 1')).toBeInTheDocument()
	})

	it('shows a loading state', () => {
		renderWithProviders(
			<TodoList isLoading isError={false} todos={undefined} />,
		)

		expect(screen.getByRole('status')).toHaveTextContent('Loading todos...')
	})

	it('shows an error message', () => {
		renderWithProviders(
			<TodoList
				isLoading={false}
				isError
				todos={undefined}
				errorMessage='Network down'
			/>,
		)

		expect(screen.getByRole('alert')).toHaveTextContent('Network down')
	})

	it('caps the visible list and reports the total', () => {
		const todos = Array.from({ length: 12 }, (_, index) => ({
			id: index + 1,
			userId: 1,
			title: `Todo ${String(index + 1)}`,
			completed: false,
		}))

		renderWithProviders(
			<TodoList isLoading={false} isError={false} todos={todos} />,
		)

		expect(screen.getByText('Showing first 10 of 12')).toBeInTheDocument()
		expect(screen.getByText('Todo 1')).toBeInTheDocument()
		expect(screen.getByText('Todo 10')).toBeInTheDocument()
		expect(screen.queryByText('Todo 11')).not.toBeInTheDocument()
	})

	it('applies compact density padding', () => {
		renderWithProviders(
			<TodoList
				isLoading={false}
				isError={false}
				density='compact'
				todos={[
					{
						id: 1,
						userId: 1,
						title: 'Compact row',
						completed: true,
					},
				]}
			/>,
		)

		const row = screen.getByText('Compact row').closest('li')
		expect(row?.className).toMatch(/py-2/)
		expect(screen.getByText('Completed.')).toBeInTheDocument()
	})
})
