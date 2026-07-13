import { getRouteApi } from '@tanstack/react-router'

import { LocationExplorer } from '@features/location'

const routeApi = getRouteApi('/')

function Home() {
	const { panel } = routeApi.useSearch()
	const navigate = routeApi.useNavigate()

	return (
		<LocationExplorer
			panel={panel}
			onPanelChange={nextPanel => {
				void navigate({
					search: previous => ({
						...previous,
						panel: nextPanel,
					}),
				})
			}}
		/>
	)
}

export default Home
