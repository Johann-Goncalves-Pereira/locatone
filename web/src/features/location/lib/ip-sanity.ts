/** Documentation / TEST-NET blocks often used by naive spoofs. */
const DOC_IPV4_CIDRS: readonly {
	readonly base: readonly [number, number, number, number]
	readonly prefix: number
	readonly label: string
}[] = [
	{ base: [192, 0, 2, 0], prefix: 24, label: 'TEST-NET-1 (192.0.2.0/24)' },
	{
		base: [198, 51, 100, 0],
		prefix: 24,
		label: 'TEST-NET-2 (198.51.100.0/24)',
	},
	{ base: [203, 0, 113, 0], prefix: 24, label: 'TEST-NET-3 (203.0.113.0/24)' },
	{ base: [0, 0, 0, 0], prefix: 8, label: 'this-network (0.0.0.0/8)' },
	{ base: [127, 0, 0, 0], prefix: 8, label: 'loopback (127.0.0.0/8)' },
	{ base: [10, 0, 0, 0], prefix: 8, label: 'private (10.0.0.0/8)' },
	{ base: [172, 16, 0, 0], prefix: 12, label: 'private (172.16.0.0/12)' },
	{ base: [192, 168, 0, 0], prefix: 16, label: 'private (192.168.0.0/16)' },
]

export interface IpSanityFinding {
	readonly ip: string
	readonly source: string
	readonly reason: string
}

function parseIpv4(
	ip: string,
): readonly [number, number, number, number] | null {
	const parts = ip.split('.')
	if (parts.length !== 4) {
		return null
	}
	const nums: number[] = []
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) {
			return null
		}
		const n = Number(part)
		if (!Number.isInteger(n) || n < 0 || n > 255) {
			return null
		}
		nums.push(n)
	}
	const a = nums[0]
	const b = nums[1]
	const c = nums[2]
	const d = nums[3]
	if (
		a === undefined ||
		b === undefined ||
		c === undefined ||
		d === undefined
	) {
		return null
	}
	return [a, b, c, d]
}

function ipv4ToInt(octets: readonly [number, number, number, number]): number {
	return (
		((octets[0] << 24) >>> 0) +
		((octets[1] << 16) >>> 0) +
		((octets[2] << 8) >>> 0) +
		(octets[3] >>> 0)
	)
}

function matchesCidr(
	ip: readonly [number, number, number, number],
	base: readonly [number, number, number, number],
	prefix: number,
): boolean {
	const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
	return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}

export function classifyDocumentationIp(ip: string): string | null {
	const trimmed = ip.trim()
	if (trimmed.includes(':')) {
		const lower = trimmed.toLowerCase()
		if (
			lower === '::1' ||
			lower.startsWith('2001:db8:') ||
			lower === '2001:db8::' ||
			/^2001:0?db8:/i.test(trimmed)
		) {
			return 'documentation IPv6 (2001:db8::/32) or loopback'
		}
		return null
	}

	const octets = parseIpv4(trimmed)
	if (octets === null) {
		return null
	}
	for (const cidr of DOC_IPV4_CIDRS) {
		if (matchesCidr(octets, cidr.base, cidr.prefix)) {
			return cidr.label
		}
	}
	return null
}

function collectStringField(
	raw: unknown,
	keys: readonly string[],
): string | null {
	if (typeof raw !== 'object' || raw === null) {
		return null
	}
	for (const key of keys) {
		const value: unknown = Reflect.get(raw, key)
		if (typeof value === 'string' && value.length > 0) {
			return value
		}
	}
	return null
}

export function extractIpsFromSignalRaw(
	source: string,
	raw: unknown,
): readonly { readonly ip: string; readonly source: string }[] {
	const found: { readonly ip: string; readonly source: string }[] = []
	const primary = collectStringField(raw, ['ip', 'query', 'ipAddress', 'IPv4'])
	if (primary !== null) {
		found.push({ ip: primary, source })
	}

	if (typeof raw === 'object' && raw !== null) {
		const candidates: unknown = Reflect.get(raw, 'candidates')
		if (Array.isArray(candidates)) {
			for (const [index, item] of candidates.entries()) {
				if (typeof item === 'string') {
					found.push({
						ip: item,
						source: `${source}.candidates[${String(index)}]`,
					})
				} else if (typeof item === 'object' && item !== null) {
					const nested = collectStringField(item, ['ip', 'address'])
					if (nested !== null) {
						found.push({
							ip: nested,
							source: `${source}.candidates[${String(index)}]`,
						})
					}
				}
			}
		}
	}

	return found
}

export function findIpSanityIssues(
	entries: readonly { readonly ip: string; readonly source: string }[],
): readonly IpSanityFinding[] {
	const findings: IpSanityFinding[] = []
	const seen = new Set<string>()
	for (const entry of entries) {
		const reason = classifyDocumentationIp(entry.ip)
		if (reason === null) {
			continue
		}
		const key = `${entry.source}:${entry.ip}:${reason}`
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		findings.push({ ip: entry.ip, source: entry.source, reason })
	}
	return findings
}
