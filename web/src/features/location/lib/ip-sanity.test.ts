import { describe, expect, it } from 'vitest'

import {
	classifyDocumentationIp,
	findIpSanityIssues,
} from '@features/location/lib/ip-sanity'

describe('ip-sanity', () => {
	it('flags TEST-NET-3', () => {
		expect(classifyDocumentationIp('203.0.113.42')).toMatch(/TEST-NET-3/)
	})

	it('accepts plausible public IPs', () => {
		expect(classifyDocumentationIp('90.190.142.88')).toBeNull()
	})

	it('collects findings from entries', () => {
		const findings = findIpSanityIssues([
			{ ip: '203.0.113.42', source: 'ip_ipwho' },
			{ ip: '90.190.142.88', source: 'ip_geojs' },
		])
		expect(findings).toHaveLength(1)
		expect(findings[0]?.source).toBe('ip_ipwho')
	})
})
