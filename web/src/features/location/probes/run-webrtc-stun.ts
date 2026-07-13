import { env } from '@lib/env'

import { fetchIpWhoPromise } from '@features/location/api/ip.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

const IPV4_PATTERN =
	/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/

function isValidIpv4(ip: string): boolean {
	return IPV4_PATTERN.test(ip) && IPV4_PATTERN.exec(ip)?.[0] === ip
}

function isPrivateIp(ip: string): boolean {
	return (
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
		ip.startsWith('127.') ||
		ip.startsWith('169.254.')
	)
}

/** Prefer RTCIceCandidate.address; fall back to a strict IPv4 match in the SDP line. */
export function extractPublicIpv4(
	address: string | null | undefined,
	candidateLine: string,
): string | undefined {
	if (
		typeof address === 'string' &&
		isValidIpv4(address) &&
		!isPrivateIp(address)
	) {
		return address
	}

	const match = IPV4_PATTERN.exec(candidateLine)
	const ip = match?.[0]
	if (ip !== undefined && !isPrivateIp(ip)) {
		return ip
	}

	return undefined
}

function extractPublicIpv4FromIce(
	candidate: RTCIceCandidate,
): string | undefined {
	return extractPublicIpv4(candidate.address, candidate.candidate)
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
				candidates.push(event.candidate.candidate)
				const ip = extractPublicIpv4FromIce(event.candidate)
				if (ip !== undefined) {
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
				confidence: 0,
				summary:
					'ICE concluído sem IPv4 público válido (rede restrita ou mascarada).',
				raw: { stunUrl, candidates, publicIps: ipList },
			})
		}

		const primaryIp = ipList[0]
		if (primaryIp === undefined) {
			return makeSignal({
				id: 'webrtc_stun',
				label,
				status: 'ok',
				confidence: 0,
				summary: 'Sem IP público útil.',
				raw: { stunUrl, candidates, publicIps: ipList },
			})
		}

		const geo = await fetchIpWhoPromise(primaryIp, signal)
		const hasCoords =
			geo.success && geo.latitude !== undefined && geo.longitude !== undefined

		if (!geo.success) {
			return makeSignal({
				id: 'webrtc_stun',
				label,
				status: 'ok',
				confidence: 0.2,
				summary: `IP STUN ${primaryIp} (geo falhou: ${geo.message ?? 'desconhecido'}).`,
				raw: {
					stunUrl,
					candidates,
					publicIps: ipList,
					geo,
				},
			})
		}

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
