import { getRouteApi } from '@tanstack/react-router'

import { TodosPanel } from '@features/todos'

const routeApi = getRouteApi('/')

function Home() {
	const { filter } = routeApi.useSearch()
	const navigate = routeApi.useNavigate()

	return (
		<TodosPanel
			filter={filter}
			onFilterChange={nextFilter => {
				void navigate({
					search: previous => ({
						...previous,
						filter: nextFilter,
					}),
				})
			}}
		/>
	)
}

export default Home
