import { Suspense, lazy } from 'react'

import { Outlet } from '@tanstack/react-router'

const RootDevtools = import.meta.env.DEV
	? lazy(() =>
			import('@layout/RootDevtools').then(module => ({
				default: module.RootDevtools,
			})),
		)
	: null

function RootLayout() {
	return (
		<>
			<Outlet />

			{RootDevtools ? (
				<Suspense fallback={null}>
					<RootDevtools />
				</Suspense>
			) : null}
		</>
	)
}

export default RootLayout
