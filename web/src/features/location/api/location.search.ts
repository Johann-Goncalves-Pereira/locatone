import { Schema } from 'effect'

import { PanelState } from '@features/location/api/location.schema'

export function parseLocationSearch(search: Record<string, unknown>): {
	readonly panel: typeof PanelState.Type
} {
	const panelRaw = search['panel']
	if (panelRaw === undefined || panelRaw === null || panelRaw === '') {
		return { panel: 'closed' }
	}

	try {
		return { panel: Schema.decodeUnknownSync(PanelState)(panelRaw) }
	} catch {
		return { panel: 'closed' }
	}
}
