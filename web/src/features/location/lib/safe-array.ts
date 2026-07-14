/**
 * Safe length / indexed reads for objects that may be Firefox Xray wrappers
 * (exportFunction returning chrome arrays denies Symbol.iterator / length).
 */
export function readArrayLength(value: unknown): number {
	if (value === null || value === undefined) {
		return 0
	}
	try {
		const length: unknown = Reflect.get(value, 'length')
		return typeof length === 'number' && Number.isFinite(length)
			? Math.max(0, Math.floor(length))
			: 0
	} catch {
		return 0
	}
}

export function readIndexedStrings(value: unknown): readonly string[] {
	const length = readArrayLength(value)
	if (length === 0 || typeof value !== 'object' || value === null) {
		return []
	}
	const out: string[] = []
	for (let index = 0; index < length; index++) {
		try {
			const item: unknown = Reflect.get(value, String(index))
			if (typeof item === 'string') {
				out.push(item)
			}
		} catch {
			/* skip opaque index */
		}
	}
	return out
}

export function readIndexedUnknown(value: unknown): readonly unknown[] {
	const length = readArrayLength(value)
	if (length === 0 || typeof value !== 'object' || value === null) {
		return []
	}
	const out: unknown[] = []
	for (let index = 0; index < length; index++) {
		try {
			out.push(Reflect.get(value, String(index)))
		} catch {
			/* skip */
		}
	}
	return out
}
