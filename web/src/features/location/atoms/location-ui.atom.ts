import { Atom } from '@effect-atom/atom-react'

import type { ProbeId } from '@features/location/api/location.schema'

export const selectedSignalIdAtom = Atom.keepAlive(
	Atom.make<ProbeId | null>(null),
)

export const scanRunIdAtom = Atom.keepAlive(Atom.make(0))
