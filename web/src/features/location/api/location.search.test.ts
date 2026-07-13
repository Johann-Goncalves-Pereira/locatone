import { describe, expect, it } from 'vitest'

import { parseLocationSearch } from '@features/location/api/location.search'

describe('parseLocationSearch', () => {
	it('defaults panel to closed', () => {
		expect(parseLocationSearch({})).toEqual({ panel: 'closed' })
	})

	it('accepts open panel', () => {
		expect(parseLocationSearch({ panel: 'open' })).toEqual({ panel: 'open' })
	})

	it('falls back on invalid panel values', () => {
		expect(parseLocationSearch({ panel: 'maybe' })).toEqual({
			panel: 'closed',
		})
	})
})
