import { env } from '@lib/env'

import { fetchIpWhoPromise } from '@features/location/api/ip.api'
import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

const IPV4_PATTERN =
	/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/

function isValidIpv4(ip: string): boolean {
	return IPV4_PATTERN.test(ip) && IPV4_PATTERN.exec(ip)?.[0] === ip
}

function isPrivateIpv4(ip: string): boolean {
	return (
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
		ip.startsWith('127.') ||
		ip.startsWith('169.254.')
	)
}

function stripIpv6Brackets(ip: string): string {
	if (ip.startsWith('[') && ip.endsWith(']')) {
		return ip.slice(1, -1)
	}
	return ip
}

function looksLikeIpv6(ip: string): boolean {
	const cleaned = stripIpv6Brackets(ip)
	if (!cleaned.includes(':') || cleaned.includes('.')) {
		return false
	}
	return /^[0-9a-fA-F:]+$/.test(cleaned) && /[0-9a-fA-F]/.test(cleaned)
}

function isPrivateOrLocalIpv6(ip: string): boolean {
	const lower = stripIpv6Brackets(ip).toLowerCase()
	if (lower === '::1' || lower === '::') {
		return true
	}
	if (lower.startsWith('fe80:')) {
		return true
	}
	if (lower.startsWith('fc') || lower.startsWith('fd')) {
		return true
	}
	if (lower.startsWith('::ffff:')) {
		return true
	}
	return false
}

function isPublicIpv6(ip: string): boolean {
	const cleaned = stripIpv6Brackets(ip)
	if (!looksLikeIpv6(cleaned)) {
		return false
	}
	return !isPrivateOrLocalIpv6(cleaned)
}

/** Prefer RTCIceCandidate.address; fall back to a strict IPv4 match in the SDP line. */
export function extractPublicIpv4(
	address: string | null | undefined,
	candidateLine: string,
): string | undefined {
	if (
		typeof address === 'string' &&
		isValidIpv4(address) &&
		!isPrivateIpv4(address)
	) {
		return address
	}

	const match = IPV4_PATTERN.exec(candidateLine)
	const ip = match?.[0]
	if (ip !== undefined && !isPrivateIpv4(ip)) {
		return ip
	}

	return undefined
}

/** Prefer RTCIceCandidate.address; fall back to IPv6 in the SDP candidate line. */
export function extractPublicIpv6(
	address: string | null | undefined,
	candidateLine: string,
): string | undefined {
	if (typeof address === 'string') {
		const cleaned = stripIpv6Brackets(address)
		if (isPublicIpv6(cleaned)) {
			return cleaned
		}
	}

	const bracketMatch = /\[([0-9a-fA-F:]+)\]/.exec(candidateLine)
	const bracketed = bracketMatch?.[1]
	if (bracketed !== undefined && isPublicIpv6(bracketed)) {
		return bracketed
	}

	const parts = candidateLine.split(' ')
	for (const part of parts) {
		const cleaned = stripIpv6Brackets(part)
		if (isPublicIpv6(cleaned)) {
			return cleaned
		}
	}

	return undefined
}

export function extractPublicIp(
	address: string | null | undefined,
	candidateLine: string,
): { readonly ip: string; readonly family: 'ipv4' | 'ipv6' } | undefined {
	const ipv4 = extractPublicIpv4(address, candidateLine)
	if (ipv4 !== undefined) {
		return { ip: ipv4, family: 'ipv4' }
	}
	const ipv6 = extractPublicIpv6(address, candidateLine)
	if (ipv6 !== undefined) {
		return { ip: ipv6, family: 'ipv6' }
	}
	return undefined
}

function extractPublicIpFromIce(
	candidate: RTCIceCandidate,
): { readonly ip: string; readonly family: 'ipv4' | 'ipv6' } | undefined {
	return extractPublicIp(candidate.address, candidate.candidate)
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
	const publicIpv4 = new Set<string>()
	const publicIpv6 = new Set<string>()

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
				const found = extractPublicIpFromIce(event.candidate)
				if (found === undefined) {
					return
				}
				if (found.family === 'ipv4') {
					publicIpv4.add(found.ip)
				} else {
					publicIpv6.add(found.ip)
				}
			}

			void pc
				.createOffer()
				.then(offer => pc.setLocalDescription(offer))
				.catch(reject)
		})

		pc.close()

		const ipv4List = [...publicIpv4]
		const ipv6List = [...publicIpv6]
		const primaryIp = ipv4List[0] ?? ipv6List[0]
		const primaryFamily =
			ipv4List[0] !== undefined
				? 'ipv4'
				: ipv6List[0] !== undefined
					? 'ipv6'
					: undefined

		if (primaryIp === undefined || primaryFamily === undefined) {
			return makeSignal({
				id: 'webrtc_stun',
				label,
				status: 'ok',
				confidence: 0,
				summary:
					'ICE concluído sem IP público válido (rede restrita ou mascarada).',
				raw: {
					stunUrl,
					candidates,
					publicIpv4: ipv4List,
					publicIpv6: ipv6List,
				},
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
				summary: `IP STUN ${primaryIp} (${primaryFamily}; geo falhou: ${geo.message ?? 'desconhecido'}).`,
				raw: {
					stunUrl,
					candidates,
					publicIpv4: ipv4List,
					publicIpv6: ipv6List,
					primaryIp,
					primaryFamily,
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
				? `IP STUN ${primaryIp} (${primaryFamily}) → ${[geo.city, geo.country].filter(Boolean).join(', ')}.`
				: `IP STUN público: ${primaryIp} (${primaryFamily}).`,
			regionHints: {
				countryCodes: geo.country_code ? [geo.country_code] : [],
				countries: geo.country ? [geo.country] : [],
				cities: geo.city ? [geo.city] : [],
			},
			raw: {
				stunUrl,
				candidates,
				publicIpv4: ipv4List,
				publicIpv6: ipv6List,
				primaryIp,
				primaryFamily,
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
