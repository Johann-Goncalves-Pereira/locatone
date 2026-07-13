import { describe, expect, it } from 'vitest'

import {
	countriesFromKeyboardLayout,
	inferKeyboardLayout,
} from '@features/location/lib/region-priors'

describe('keyboard layout priors', () => {
	it('detects AZERTY from distinctive mappings', () => {
		const map = new Map([
			['KeyA', 'q'],
			['KeyQ', 'a'],
			['KeyW', 'z'],
			['KeyZ', 'w'],
		])
		expect(inferKeyboardLayout(map)).toBe('azerty')
		expect(countriesFromKeyboardLayout('azerty')).toEqual(['FR', 'BE'])
	})

	it('detects QWERTZ from Y/Z swap', () => {
		const map = new Map([
			['KeyQ', 'q'],
			['KeyW', 'w'],
			['KeyA', 'a'],
			['KeyY', 'z'],
			['KeyZ', 'y'],
		])
		expect(inferKeyboardLayout(map)).toBe('qwertz')
		expect(countriesFromKeyboardLayout('qwertz')).toEqual(['DE', 'AT', 'CH'])
	})

	it('detects QWERTY without country prior', () => {
		const map = new Map([
			['KeyQ', 'q'],
			['KeyW', 'w'],
			['KeyA', 'a'],
			['KeyY', 'y'],
			['KeyZ', 'z'],
		])
		expect(inferKeyboardLayout(map)).toBe('qwerty')
		expect(countriesFromKeyboardLayout('qwerty')).toEqual([])
	})
})
