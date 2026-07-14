import type { LocationSignal } from '@features/location/api/location.schema'
import { makeSignal } from '@features/location/probes/signal-helpers'

type OrientationPermission = 'granted' | 'denied' | 'prompt'

function isPermissionState(value: unknown): value is PermissionState {
	return value === 'granted' || value === 'denied' || value === 'prompt'
}

function getOrientationPermissionRequest():
	| (() => Promise<PermissionState>)
	| undefined {
	const maybe: unknown = Reflect.get(
		DeviceOrientationEvent,
		'requestPermission',
	)
	if (typeof maybe !== 'function') {
		return undefined
	}

	const request = maybe

	return () =>
		new Promise<PermissionState>((resolve, reject) => {
			try {
				const result: unknown = Reflect.apply(
					request,
					DeviceOrientationEvent,
					[],
				)
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

async function requestOrientationPermission(): Promise<OrientationPermission> {
	const request = getOrientationPermissionRequest()
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

function readAbsoluteFlag(event: DeviceOrientationEvent): boolean | null {
	if (!('absolute' in event)) {
		return null
	}
	const value: unknown = Reflect.get(event, 'absolute')
	return typeof value === 'boolean' ? value : null
}

export async function runCompassProbe(): Promise<LocationSignal> {
	const label = 'Bússola / orientação'
	if (
		typeof window === 'undefined' ||
		typeof DeviceOrientationEvent === 'undefined'
	) {
		return makeSignal({
			id: 'compass',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'DeviceOrientation indisponível.',
			raw: { reason: 'unsupported' },
		})
	}

	const permission = await requestOrientationPermission()
	if (permission === 'denied') {
		return makeSignal({
			id: 'compass',
			label,
			status: 'denied',
			confidence: 0,
			summary: 'Permissão de orientação negada.',
			raw: { permission },
		})
	}

	return await new Promise<LocationSignal>(resolve => {
		let settled = false
		const timeout = window.setTimeout(() => {
			finish(
				makeSignal({
					id: 'compass',
					label,
					status: 'ok',
					confidence: 0.05,
					summary:
						'Nenhum evento de orientação recebido (desktop ou sensor ausente).',
					raw: { permission, received: false },
				}),
			)
		}, 2_000)

		function finish(signalResult: LocationSignal) {
			if (settled) {
				return
			}
			settled = true
			window.clearTimeout(timeout)
			window.removeEventListener('deviceorientation', onOrientation)
			window.removeEventListener('deviceorientationabsolute', onAbsolute)
			resolve(signalResult)
		}

		function emit(event: DeviceOrientationEvent, kind: string) {
			const alpha = event.alpha
			finish(
				makeSignal({
					id: 'compass',
					label,
					status: 'ok',
					confidence: alpha === null ? 0.05 : 0.12,
					summary:
						alpha === null
							? `Orientação (${kind}) sem heading magnético útil.`
							: `Heading magnético ~${Math.round(alpha)}° via ${kind}.`,
					raw: {
						permission,
						kind,
						alpha,
						beta: event.beta,
						gamma: event.gamma,
						absolute: readAbsoluteFlag(event),
					},
				}),
			)
		}

		function onOrientation(event: DeviceOrientationEvent) {
			emit(event, 'deviceorientation')
		}

		function onAbsolute(event: DeviceOrientationEvent) {
			emit(event, 'deviceorientationabsolute')
		}

		window.addEventListener('deviceorientation', onOrientation)
		window.addEventListener('deviceorientationabsolute', onAbsolute)
	})
}
