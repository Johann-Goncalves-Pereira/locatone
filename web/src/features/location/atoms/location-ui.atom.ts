import { Atom } from '@effect-atom/atom-react'

import type { ProbeId } from '@features/location/api/location.schema'

export const selectedSignalIdsAtom = Atom.keepAlive(
	Atom.make<readonly ProbeId[]>([]),
)

export const scanRunIdAtom = Atom.keepAlive(Atom.make(0))
