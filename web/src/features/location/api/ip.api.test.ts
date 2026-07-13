import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { parseCloudflareTrace } from '@features/location/api/ip.api'
import {
	GeoJsResponse,
	IpWhoResponse,
} from '@features/location/api/location.schema'

describe('ip.api', () => {
	it('parses Cloudflare trace key/value text', () => {
		const trace = parseCloudflareTrace(
			['fl=123', 'ip=203.0.113.10', 'loc=BR', 'colo=GRU', ''].join('\n'),
		)

		expect(trace.ip).toBe('203.0.113.10')
		expect(trace.loc).toBe('BR')
		expect(trace.colo).toBe('GRU')
	})

	it('decodes ipwho success payloads', () => {
		const decoded = Schema.decodeUnknownSync(IpWhoResponse)({
			success: true,
			ip: '203.0.113.10',
			country: 'Brazil',
			country_code: 'BR',
			city: 'São Paulo',
			latitude: -23.55,
			longitude: -46.63,
		})

		expect(decoded.country_code).toBe('BR')
		expect(decoded.latitude).toBe(-23.55)
	})

	it('decodes geojs payloads with string coordinates', () => {
		const decoded = Schema.decodeUnknownSync(GeoJsResponse)({
			ip: '203.0.113.10',
			country: 'Brazil',
			country_code: 'BR',
			city: 'São Paulo',
			latitude: '-23.55',
			longitude: '-46.63',
			timezone: 'America/Sao_Paulo',
		})

		expect(decoded.country_code).toBe('BR')
		expect(decoded.latitude).toBe('-23.55')
		expect(decoded.longitude).toBe('-46.63')
	})
})
