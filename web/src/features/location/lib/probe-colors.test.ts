import { describe, expect, it } from 'vitest'

import {
	FUSED_COLOR,
	probeColor,
	shortProbeLabel,
} from '@features/location/lib/probe-colors'

describe('probe-colors', () => {
	it('gives timezone a purple tone and IP greens', () => {
		expect(probeColor('timezone')).toBe('#A855F7')
		expect(probeColor('ip_cloudflare')).toBe('#34D399')
		expect(probeColor('ip_ipwho')).toBe('#10B981')
	})

	it('exposes fused accent and short labels', () => {
		expect(FUSED_COLOR).toBe('#3EE0C0')
		expect(shortProbeLabel('timezone')).toBe('Fuso')
		expect(shortProbeLabel('gps')).toBe('GPS')
	})
})
