import type { LocationSignal } from '@features/location/api/location.schema'

const STATUS_LABEL: Record<LocationSignal['status'], string> = {
	ok: 'ok',
	denied: 'negado',
	unsupported: 'sem suporte',
	error: 'erro',
}

function hasLocationContribution(signal: LocationSignal): boolean {
	if (signal.lat !== undefined && signal.lng !== undefined) {
		return true
	}

	const countries = signal.regionHints?.countryCodes
	return countries !== undefined && countries.length > 0
}

/** Badge text for a probe — no misleading % on contextual / empty signals. */
export function signalBadgeLabel(signal: LocationSignal): string {
	const status = STATUS_LABEL[signal.status]

	if (signal.status !== 'ok') {
		return status
	}

	if (!hasLocationContribution(signal)) {
		return status
	}

	const confidencePct = Math.round(signal.confidence * 100)
	return `${status} · confiança ${String(confidencePct)}%`
}

export { STATUS_LABEL }
