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
		const timeout = window.setTimeout(() => {
			window.removeEventListener('deviceorientation', onOrientation)
			resolve(
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

		function onOrientation(event: DeviceOrientationEvent) {
			window.clearTimeout(timeout)
			window.removeEventListener('deviceorientation', onOrientation)
			const alpha = event.alpha
			resolve(
				makeSignal({
					id: 'compass',
					label,
					status: 'ok',
					confidence: alpha === null ? 0.05 : 0.1,
					summary:
						alpha === null
							? 'Orientação sem heading magnético útil.'
							: `Heading magnético ~${Math.round(alpha)}° (corroboração fraca).`,
					raw: {
						permission,
						alpha,
						beta: event.beta,
						gamma: event.gamma,
						absolute: readAbsoluteFlag(event),
					},
				}),
			)
		}

		window.addEventListener('deviceorientation', onOrientation)
	})
}
