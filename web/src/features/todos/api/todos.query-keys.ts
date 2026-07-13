export const todoKeys = {
	all: ['todos'] as const,
	lists: () => [...todoKeys.all, 'list'] as const,
	list: () => [...todoKeys.lists()] as const,
}
