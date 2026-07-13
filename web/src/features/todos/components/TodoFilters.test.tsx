import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TodoFilters } from '@features/todos/components/TodoFilters'

import { renderWithProviders } from '@/test/test-utils'

describe('TodoFilters', () => {
	it('marks the active filter and notifies on change', async () => {
		const user = userEvent.setup()
		const onFilterChange = vi.fn()

		renderWithProviders(
			<TodoFilters filter='active' onFilterChange={onFilterChange} />,
		)

		expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute(
			'aria-pressed',
			'true',
		)
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
			'aria-pressed',
			'false',
		)

		await user.click(screen.getByRole('button', { name: 'Done' }))
		expect(onFilterChange).toHaveBeenCalledWith('done')
	})
})
