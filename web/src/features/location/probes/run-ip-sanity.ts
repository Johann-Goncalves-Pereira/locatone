import type { LocationSignal } from '@features/location/api/location.schema'
import {
	extractIpsFromSignalRaw,
	findIpSanityIssues,
} from '@features/location/lib/ip-sanity'
import { makeSignal } from '@features/location/probes/signal-helpers'

const IP_SIGNAL_IDS = [
	'ip_cloudflare',
	'ip_ipwho',
	'ip_geojs',
	'webrtc_stun',
	'edge_geo',
] as const

export function runIpSanityProbe(
	signals: readonly LocationSignal[],
): LocationSignal {
	const label = 'Sanidade de IP (TEST-NET / doc)'
	const entries = IP_SIGNAL_IDS.flatMap(id => {
		const signal = signals.find(item => item.id === id)
		if (signal?.status !== 'ok') {
			return []
		}
		return extractIpsFromSignalRaw(id, signal.raw)
	})

	const findings = findIpSanityIssues(entries)
	const suspicious = findings.length > 0

	return makeSignal({
		id: 'ip_sanity',
		label,
		status: 'ok',
		confidence: suspicious ? 0.55 : entries.length > 0 ? 0.2 : 0.05,
		summary: suspicious
			? `IP documental/suspeito: ${findings.map(item => `${item.ip} (${item.reason})`).join('; ')}.`
			: entries.length > 0
				? `IPs observados não estão em blocos de documentação (${String(entries.length)} amostra(s)).`
				: 'Sem IPs de provedores para auditar.',
		raw: {
			entries,
			findings,
			suspicious,
		},
	})
}
