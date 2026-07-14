import { describe, expect, it } from 'vitest'

import { parseDateStringTz } from '@features/location/lib/parse-date-string-tz'

describe('parseDateStringTz', () => {
	it('extracts Brasilia style labels and GMT offset', () => {
		const dateString =
			'Tue Jul 14 2026 08:23:00 GMT-0300 (Brasilia Standard Time)'
		const timeString = '08:23:00 GMT-0300'
		const parsed = parseDateStringTz(dateString, timeString)
		expect(parsed.gmtOffsetMinutes).toBe(-180)
		expect(parsed.countryCodes).toContain('BR')
		expect(parsed.parenLabel).toMatch(/Brasilia/i)
	})

	it('extracts Eastern European Summer Time priors', () => {
		const dateString =
			'Tue Jul 14 2026 14:23:00 GMT+0300 (Eastern European Summer Time)'
		const timeString = '14:23:00 GMT+0300'
		const parsed = parseDateStringTz(dateString, timeString)
		expect(parsed.gmtOffsetMinutes).toBe(180)
		expect(parsed.countryCodes).toContain('EE')
	})
})
