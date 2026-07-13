import { Atom } from '@effect-atom/atom-react'

export type ListDensity = 'comfortable' | 'compact'

export const listDensityAtom = Atom.keepAlive(
	Atom.make<ListDensity>('comfortable'),
)
