import { describe, expect, it } from 'vitest'

import {
	extractPublicIp,
	extractPublicIpv4,
	extractPublicIpv6,
} from '@features/location/probes/run-webrtc-stun'

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

describe('extractPublicIpv6', () => {
	it('accepts public IPv6 from address', () => {
		expect(
			extractPublicIpv6(
				'2001:db8:85a3::8a2e:370:7334',
				'candidate:1 1 udp 1 2001:db8:85a3::8a2e:370:7334 9 typ srflx',
			),
		).toBe('2001:db8:85a3::8a2e:370:7334')
	})

	it('accepts bracketed IPv6 in the candidate line', () => {
		expect(
			extractPublicIpv6(
				undefined,
				'candidate:1 1 udp 1 [2001:4860:4860::8888] 9 typ srflx',
			),
		).toBe('2001:4860:4860::8888')
	})

	it('rejects link-local IPv6', () => {
		expect(
			extractPublicIpv6('fe80::1', 'candidate:1 1 udp 1 fe80::1 9 typ host'),
		).toBeUndefined()
	})

	it('rejects ULA IPv6', () => {
		expect(
			extractPublicIpv6(
				'fd12:3456:789a::1',
				'candidate:1 1 udp 1 fd12:3456:789a::1 9 typ host',
			),
		).toBeUndefined()
	})
})

describe('extractPublicIp', () => {
	it('prefers IPv4 when both families appear', () => {
		expect(
			extractPublicIp(
				'45.181.39.54',
				'candidate:1 1 udp 1 45.181.39.54 9 typ srflx',
			),
		).toEqual({ ip: '45.181.39.54', family: 'ipv4' })
	})

	it('returns IPv6 when only IPv6 is present', () => {
		expect(
			extractPublicIp(
				'2001:4860:4860::8888',
				'candidate:1 1 udp 1 2001:4860:4860::8888 9 typ srflx',
			),
		).toEqual({ ip: '2001:4860:4860::8888', family: 'ipv6' })
	})
})
