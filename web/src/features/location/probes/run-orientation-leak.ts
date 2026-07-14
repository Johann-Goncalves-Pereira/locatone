import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

type OrientationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

function isPermissionState(value: unknown): value is PermissionState {
	return value === 'granted' || value === 'denied' || value === 'prompt'
}

function getOrientationPermissionRequest(
	ctor: typeof DeviceOrientationEvent,
): (() => Promise<PermissionState>) | undefined {
	const maybe: unknown = Reflect.get(ctor, 'requestPermission')
	if (typeof maybe !== 'function') {
		return undefined
	}
	const request = maybe
	return () =>
		new Promise<PermissionState>((resolve, reject) => {
			try {
				const result: unknown = Reflect.apply(request, ctor, [])
				void Promise.resolve(result).then(state => {
					if (isPermissionState(state)) {
						resolve(state)
						return
					}
					resolve('denied')
				}, reject)
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)))
			}
		})
}

async function requestPermission(
	ctor: typeof DeviceOrientationEvent | undefined,
): Promise<OrientationPermission> {
	if (ctor === undefined) {
		return 'unsupported'
	}
	const request = getOrientationPermissionRequest(ctor)
	if (request === undefined) {
		return 'granted'
	}
	try {
		const state = await request()
		if (state === 'granted' || state === 'denied') {
			return state
		}
		return 'prompt'
	} catch {
		return 'denied'
	}
}

interface OrientationSample {
	readonly kind: 'deviceorientation' | 'deviceorientationabsolute'
	readonly alpha: number | null
	readonly beta: number | null
	readonly gamma: number | null
	readonly absolute: boolean | null
}

function readAbsoluteFlag(event: DeviceOrientationEvent): boolean | null {
	if (!('absolute' in event)) {
		return null
	}
	const value: unknown = Reflect.get(event, 'absolute')
	return typeof value === 'boolean' ? value : null
}

function listenOnce(
	eventName: 'deviceorientation' | 'deviceorientationabsolute',
	timeoutMs: number,
): Promise<OrientationSample | null> {
	return new Promise(resolve => {
		const onEvent = (event: Event) => {
			if (!(event instanceof DeviceOrientationEvent)) {
				return
			}
			cleanup()
			resolve({
				kind: eventName,
				alpha: event.alpha,
				beta: event.beta,
				gamma: event.gamma,
				absolute: readAbsoluteFlag(event),
			})
		}
		const timer = window.setTimeout(() => {
			cleanup()
			resolve(null)
		}, timeoutMs)
		function cleanup() {
			window.clearTimeout(timer)
			window.removeEventListener(eventName, onEvent)
		}
		window.addEventListener(eventName, onEvent)
	})
}

/**
 * Legacy DeviceOrientation path that Sensor-constructor stubs often miss.
 * Presence of a real heading sample is soft evidence that orientation is not
 * fully neutralized by an extension.
 */
export async function runOrientationLeakProbe(): Promise<LocationSignal> {
	const label = 'Orientação legada (deviceorientation)'
	if (
		typeof window === 'undefined' ||
		typeof DeviceOrientationEvent === 'undefined'
	) {
		return makeSignal({
			id: 'orientation_leak',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'DeviceOrientationEvent indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	const relativePermission = await requestPermission(DeviceOrientationEvent)
	if (relativePermission === 'denied') {
		return makeSignal({
			id: 'orientation_leak',
			label,
			status: 'denied',
			confidence: 0,
			summary: 'Permissão de orientação negada.',
			raw: { permission: relativePermission },
		})
	}

	const [relative, absolute] = await Promise.all([
		listenOnce('deviceorientation', 2_000),
		listenOnce('deviceorientationabsolute', 2_000),
	])

	const sample = absolute ?? relative
	if (sample === null) {
		return makeSignal({
			id: 'orientation_leak',
			label,
			status: 'ok',
			confidence: 0.08,
			summary:
				'Nenhum evento deviceorientation (sensor ausente ou stub silencioso).',
			raw: {
				permission: relativePermission,
				relative: null,
				absolute: null,
				leaked: false,
			},
		})
	}

	const hasHeading =
		typeof sample.alpha === 'number' && Number.isFinite(sample.alpha)

	return makeSignal({
		id: 'orientation_leak',
		label,
		status: 'ok',
		confidence: hasHeading ? 0.28 : 0.12,
		summary: hasHeading
			? `Orientação legada ativa (${sample.kind}, α≈${Math.round(sample.alpha)}°) — sensor real provavelmente não stubado.`
			: `Evento ${sample.kind} sem heading magnético útil.`,
		raw: {
			permission: relativePermission,
			relative,
			absolute,
			leaked: hasHeading,
		},
	})
}
