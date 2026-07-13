import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TodosPanel } from '@features/todos/components/TodosPanel'

import { renderWithProviders } from '@/test/test-utils'

vi.mock('@features/todos/hooks/useTodosPage', () => ({
	useTodosPage: () => ({
		filter: 'all',
		todos: [
			{
				id: 1,
				userId: 1,
				title: 'Density demo',
				completed: false,
			},
		],
		isLoading: false,
		isError: false,
		errorMessage: undefined,
	}),
}))

describe('TodosPanel density atom', () => {
	it('toggles list density via Effect Atom', async () => {
		const user = userEvent.setup()

		renderWithProviders(
			<TodosPanel filter='all' onFilterChange={() => undefined} />,
		)

		const row = screen.getByText('Density demo').closest('li')
		expect(row?.className).toMatch(/py-3/)

		await user.click(screen.getByRole('button', { name: 'Compact view' }))

		expect(
			screen.getByRole('button', { name: 'Comfortable view' }),
		).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByText('Density demo').closest('li')?.className).toMatch(
			/py-2/,
		)
	})
})
