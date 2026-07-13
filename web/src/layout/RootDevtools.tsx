import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export function RootDevtools() {
	return (
		<>
			<TanStackRouterDevtools />
			<ReactQueryDevtools buttonPosition='top-right' />
		</>
	)
}
