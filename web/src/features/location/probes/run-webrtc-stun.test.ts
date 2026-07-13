import { describe, expect, it } from 'vitest'

import { extractPublicIpv4 } from '@features/location/probes/run-webrtc-stun'

describe('extractPublicIpv4', () => {
	it('accepts a real srflx IPv4 from address', () => {
		expect(
			extractPublicIpv4(
				'45.181.39.54',
				'candidate:1 1 udp 1677729535 45.181.39.54 54321 typ srflx',
			),
		).toBe('45.181.39.54')
	})

	it('accepts IPv4 parsed from the candidate line', () => {
		expect(
			extractPublicIpv4(
				undefined,
				'candidate:1 1 udp 1677729535 45.181.39.54 54321 typ srflx',
			),
		).toBe('45.181.39.54')
	})

	it('rejects foundation-like garbage tokens', () => {
		expect(
			extractPublicIpv4(undefined, 'candidate:e:2450505687 1 udp 1 typ host'),
		).toBeUndefined()
	})

	it('rejects private IPv4', () => {
		expect(
			extractPublicIpv4(
				'192.168.0.10',
				'candidate:1 1 udp 1 192.168.0.10 9 typ host',
			),
		).toBeUndefined()
	})
})
