import { type ReactElement, type ReactNode, useMemo } from 'react'

import { RegistryProvider } from '@effect-atom/atom-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, render } from '@testing-library/react'

import { createQueryClient } from '@lib/query-client'

interface ProvidersProps {
	children: ReactNode
}

function TestProviders({ children }: ProvidersProps) {
	const queryClient = useMemo(() => createQueryClient(), [])

	return (
		<RegistryProvider>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</RegistryProvider>
	)
}

export function renderWithProviders(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
) {
	return render(ui, {
		wrapper: TestProviders,
		...options,
	})
}
