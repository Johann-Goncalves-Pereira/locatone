import { describe, expect, it } from 'vitest'

import {
	readArrayLength,
	readIndexedStrings,
} from '@features/location/lib/safe-array'

describe('safe-array', () => {
	it('reads length and string indices without iterators', () => {
		const opaque = { 0: 'et-EE', 1: 'et', length: 2 }
		expect(readArrayLength(opaque)).toBe(2)
		expect(readIndexedStrings(opaque)).toEqual(['et-EE', 'et'])
	})

	it('returns empty for non-array-likes', () => {
		expect(readArrayLength(null)).toBe(0)
		expect(readIndexedStrings({})).toEqual([])
	})
})
