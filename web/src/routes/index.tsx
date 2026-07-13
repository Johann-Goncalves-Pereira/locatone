import { createFileRoute } from '@tanstack/react-router'

import { parseLocationSearch } from '@features/location'

import Home from '@pages/Home'

export const Route = createFileRoute('/')({
	validateSearch: search => parseLocationSearch(search),
	component: Home,
})
