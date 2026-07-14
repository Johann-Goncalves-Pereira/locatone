import type { LocationSignal } from '@features/location/api/location.schema'
import {
	evaluateMagneticConsistency,
	magneticFieldMagnitudeUt,
} from '@features/location/lib/wmm-bands'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface MagnetometerLike {
	start: () => void
	stop: () => void
	addEventListener: (type: 'reading', listener: () => void) => void
	removeEventListener: (type: 'reading', listener: () => void) => void
	readonly x: number | null
	readonly y: number | null
	readonly z: number | null
}

function isMagnetometerLike(value: unknown): value is MagnetometerLike {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	return (
		typeof Reflect.get(value, 'start') === 'function' &&
		typeof Reflect.get(value, 'stop') === 'function' &&
		typeof Reflect.get(value, 'addEventListener') === 'function' &&
		typeof Reflect.get(value, 'removeEventListener') === 'function'
	)
}

function createMagnetometer(frequency: number): MagnetometerLike | undefined {
	const ctor: unknown = Reflect.get(globalThis, 'Magnetometer')
	if (typeof ctor !== 'function') {
		return undefined
	}
	try {
		const instance: unknown = Reflect.construct(ctor, [{ frequency }])
		return isMagnetometerLike(instance) ? instance : undefined
	} catch {
		return undefined
	}
}

function sampleMagnetometer(
	sensor: MagnetometerLike,
): Promise<{ readonly x: number; readonly y: number; readonly z: number }> {
	return new Promise((resolve, reject) => {
		const readings: {
			readonly x: number
			readonly y: number
			readonly z: number
		}[] = []
		const timeout = window.setTimeout(() => {
			cleanup()
			if (readings.length === 0) {
				reject(new Error('No magnetometer readings'))
				return
			}
			const last = readings[readings.length - 1]
			if (last === undefined) {
				reject(new Error('No magnetometer readings'))
				return
			}
			resolve(last)
		}, 1_500)

		function onReading() {
			const x = sensor.x
			const y = sensor.y
			const z = sensor.z
			if (x === null || y === null || z === null) {
				return
			}
			readings.push({ x, y, z })
			if (readings.length >= 5) {
				cleanup()
				const last = readings[readings.length - 1]
				if (last !== undefined) {
					resolve(last)
				}
			}
		}

		function cleanup() {
			window.clearTimeout(timeout)
			sensor.removeEventListener('reading', onReading)
			try {
				sensor.stop()
			} catch {
				// ignore
			}
		}

		sensor.addEventListener('reading', onReading)
		try {
			sensor.start()
		} catch (error) {
			cleanup()
			reject(error instanceof Error ? error : new Error(String(error)))
		}
	})
}

export async function runMagnetometerProbe(
	ipCountryCodes: readonly string[] = [],
): Promise<LocationSignal> {
	const label = 'Campo geomagnético (WMM)'
	const sensor = createMagnetometer(10)
	if (sensor === undefined) {
		return makeSignal({
			id: 'magnetometer',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'Magnetometer API indisponível neste navegador.',
			raw: { reason: 'unsupported' },
		})
	}

	try {
		const reading = await sampleMagnetometer(sensor)
		const magnitudeUt = magneticFieldMagnitudeUt(
			reading.x,
			reading.y,
			reading.z,
		)
		const evaluation = evaluateMagneticConsistency({
			magnitudeUt,
			countryCodes: ipCountryCodes,
		})

		const confidence = evaluation.conflicted
			? 0.35
			: evaluation.compatibleCountries.length > 0
				? 0.28
				: 0.18

		return makeSignal({
			id: 'magnetometer',
			label,
			status: 'ok',
			confidence,
			summary: evaluation.conflicted
				? `|B|≈${magnitudeUt.toFixed(1)} µT incompatível com IP (${evaluation.incompatibleCountries.join(', ')}). Possível VPN.`
				: evaluation.compatibleCountries.length > 0
					? `|B|≈${magnitudeUt.toFixed(1)} µT compatível com ${evaluation.compatibleCountries.join(', ')}.`
					: `|B|≈${magnitudeUt.toFixed(1)} µT (faixa geomagnética local).`,
			regionHints: {
				countryCodes: [...evaluation.compatibleCountries],
			},
			raw: {
				x: reading.x,
				y: reading.y,
				z: reading.z,
				magnitudeUt,
				...evaluation,
				comparedCountries: [...ipCountryCodes],
			},
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const denied =
			message.toLowerCase().includes('permission') ||
			message.toLowerCase().includes('not allowed')
		return makeSignal({
			id: 'magnetometer',
			label,
			status: denied ? 'denied' : 'error',
			confidence: 0,
			summary: denied
				? 'Permissão de magnetômetro negada.'
				: `Falha no magnetômetro: ${message}`,
			raw: { error: message },
		})
	}
}
