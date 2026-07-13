import { type ReactNode, useRef } from 'react'

import { RegistryProvider } from '@effect-atom/atom-react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createQueryClient } from '@lib/query-client'

interface AppProvidersProps {
	children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
	const queryClientRef = useRef<ReturnType<typeof createQueryClient> | null>(
		null,
	)
	queryClientRef.current ??= createQueryClient()
	const queryClient = queryClientRef.current

	return (
		<RegistryProvider>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</RegistryProvider>
	)
}
