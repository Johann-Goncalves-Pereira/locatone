import { createFileRoute } from '@tanstack/react-router'

import { parseTodosSearch } from '@features/todos'

import Home from '@pages/Home'

export const Route = createFileRoute('/')({
	validateSearch: search => parseTodosSearch(search),
	component: Home,
})
