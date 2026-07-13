import { env } from '@lib/env'

import { fetchIpWhoPromise } from '@features/location/api/ip.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

function extractIpFromCandidate(candidate: string): string | undefined {
	const patterns = [
		/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/,
		/([a-f0-9:]+:+[a-f0-9:]+)/i,
	]
	for (const pattern of patterns) {
		const match = pattern.exec(candidate)
		const ip = match?.[1]
		if (ip !== undefined && !ip.startsWith('0.') && ip !== '0.0.0.0') {
			return ip
		}
	}
	return undefined
}

function isPrivateIp(ip: string): boolean {
	if (ip.includes(':')) {
		return (
			ip.startsWith('fc') ||
			ip.startsWith('fd') ||
			ip.startsWith('fe80') ||
			ip === '::1'
		)
	}
	return (
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
		ip.startsWith('127.') ||
		ip.startsWith('169.254.')
	)
}

export async function runWebRtcStunProbe(
	signal?: AbortSignal,
): Promise<LocationSignal> {
	const label = 'WebRTC ICE / STUN'
	if (typeof RTCPeerConnection === 'undefined') {
		return makeSignal({
			id: 'webrtc_stun',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'WebRTC indisponível neste ambiente.',
			raw: { reason: 'unsupported' },
		})
	}

	const stunUrl = env.VITE_STUN_URL
	const candidates: string[] = []
	const publicIps = new Set<string>()

	try {
		const pc = new RTCPeerConnection({
			iceServers: [{ urls: stunUrl }],
		})

		pc.createDataChannel('locatone')

		await new Promise<void>((resolve, reject) => {
			const timeout = window.setTimeout(() => {
				resolve()
			}, 4_000)

			if (signal !== undefined) {
				signal.addEventListener(
					'abort',
					() => {
						window.clearTimeout(timeout)
						reject(new DOMException('Aborted', 'AbortError'))
					},
					{ once: true },
				)
			}

			pc.onicecandidate = event => {
				if (event.candidate === null) {
					window.clearTimeout(timeout)
					resolve()
					return
				}
				const raw = event.candidate.candidate
				candidates.push(raw)
				const ip = extractIpFromCandidate(raw)
				if (ip !== undefined && !isPrivateIp(ip)) {
					publicIps.add(ip)
				}
			}

			void pc
				.createOffer()
				.then(offer => pc.setLocalDescription(offer))
				.catch(reject)
		})

		pc.close()

		const ipList = [...publicIps]
		if (ipList.length === 0) {
			return makeSignal({
				id: 'webrtc_stun',
				label,
				status: 'ok',
				confidence: 0.15,
				summary:
					'ICE concluído sem IP público (rede restrita ou IP mascarado).',
				raw: { stunUrl, candidates, publicIps: ipList },
			})
		}

		const primaryIp = ipList[0]
		if (primaryIp === undefined) {
			return makeSignal({
				id: 'webrtc_stun',
				label,
				status: 'ok',
				confidence: 0.15,
				summary: 'Sem IP público útil.',
				raw: { stunUrl, candidates, publicIps: ipList },
			})
		}

		const geo = await fetchIpWhoPromise(primaryIp, signal)
		const hasCoords =
			geo.success && geo.latitude !== undefined && geo.longitude !== undefined

		return makeSignal({
			id: 'webrtc_stun',
			label,
			status: 'ok',
			confidence: hasCoords ? 0.58 : 0.4,
			...(hasCoords
				? {
						lat: geo.latitude,
						lng: geo.longitude,
						accuracyMeters: 90_000,
					}
				: {}),
			summary: hasCoords
				? `IP STUN ${primaryIp} → ${[geo.city, geo.country].filter(Boolean).join(', ')}.`
				: `IP STUN público: ${primaryIp}.`,
			regionHints: {
				countryCodes: geo.country_code ? [geo.country_code] : [],
				countries: geo.country ? [geo.country] : [],
				cities: geo.city ? [geo.city] : [],
			},
			raw: {
				stunUrl,
				candidates,
				publicIps: ipList,
				geo,
			},
		})
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
		return makeSignal({
			id: 'webrtc_stun',
			label,
			status: 'error',
			confidence: 0,
			summary: error instanceof Error ? error.message : 'Falha no probe WebRTC',
			raw: { error: String(error) },
		})
	}
}
