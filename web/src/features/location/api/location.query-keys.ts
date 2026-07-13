export const locationKeys = {
	all: ['location'] as const,
	probes: () => [...locationKeys.all, 'probes'] as const,
	scan: (runId: number) => [...locationKeys.probes(), 'scan', runId] as const,
}
