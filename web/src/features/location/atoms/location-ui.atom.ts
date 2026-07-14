import { Atom } from '@effect-atom/atom-react'

import type { ProbeId } from '@features/location/api/location.schema'
import {
	DEFAULT_OPEN_PANEL_GROUPS,
	type PanelGroupKey,
} from '@features/location/lib/signal-panel'

export const selectedSignalIdsAtom = Atom.keepAlive(
	Atom.make<readonly ProbeId[]>([]),
)

export const scanRunIdAtom = Atom.keepAlive(Atom.make(0))

export const sectionOpenAtom = Atom.keepAlive(
	Atom.make<readonly PanelGroupKey[]>([...DEFAULT_OPEN_PANEL_GROUPS]),
)
