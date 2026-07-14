import type { LocationSignal } from '@features/location/api/location.schema'
import { elevationFromPressureHpa } from '@features/location/lib/barometric'
import { makeSignal } from '@features/location/probes/signal-helpers'

interface PressureSensorLike {
	start: () => void
	stop: () => void
	addEventListener: (type: 'reading', listener: () => void) => void
	removeEventListener: (type: 'reading', listener: () => void) => void
	readonly pressure: number | null
}

function isPressureSensorLike(value: unknown): value is PressureSensorLike {
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

function createPressureSensor(
	frequency: number,
): PressureSensorLike | undefined {
	const ctor: unknown = Reflect.get(globalThis, 'PressureSensor')
	if (typeof ctor !== 'function') {
		return undefined
	}
	try {
		const instance: unknown = Reflect.construct(ctor, [{ frequency }])
		return isPressureSensorLike(instance) ? instance : undefined
	} catch {
		return undefined
	}
}

function samplePressure(sensor: PressureSensorLike): Promise<number> {
	return new Promise((resolve, reject) => {
		const timeout = window.setTimeout(() => {
			cleanup()
			reject(new Error('No pressure readings'))
		}, 2_000)

		function onReading() {
			const pressure = sensor.pressure
			if (pressure === null) {
				return
			}
			cleanup()
			resolve(pressure)
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

export async function runBarometerProbe(
	gpsAltitudeMeters?: number,
): Promise<LocationSignal> {
	const label = 'Barômetro / pressão'
	const sensor = createPressureSensor(5)
	if (sensor === undefined) {
		return makeSignal({
			id: 'barometer',
			label,
			status: 'unsupported',
			confidence: 0,
			summary: 'PressureSensor API indisponível neste navegador.',
			raw: { reason: 'unsupported' },
		})
	}

	try {
		const pressureHpa = await samplePressure(sensor)
		const elevationMeters = elevationFromPressureHpa(pressureHpa)
		const gpsAltitude =
			gpsAltitudeMeters !== undefined && Number.isFinite(gpsAltitudeMeters)
				? gpsAltitudeMeters
				: undefined
		const agrees =
			gpsAltitude !== undefined && Number.isFinite(elevationMeters)
				? Math.abs(gpsAltitude - elevationMeters) <= 120
				: undefined

		return makeSignal({
			id: 'barometer',
			label,
			status: 'ok',
			confidence: agrees === true ? 0.3 : agrees === false ? 0.22 : 0.18,
			summary: Number.isFinite(elevationMeters)
				? agrees === true
					? `Pressão ${pressureHpa.toFixed(1)} hPa ≈ ${Math.round(elevationMeters)} m; alinha com GPS.`
					: agrees === false
						? `Pressão ${pressureHpa.toFixed(1)} hPa ≈ ${Math.round(elevationMeters)} m; diverge do GPS (${Math.round(gpsAltitude ?? 0)} m).`
						: `Pressão ${pressureHpa.toFixed(1)} hPa ≈ elevação ${Math.round(elevationMeters)} m (atmosfera padrão).`
				: `Pressão ${pressureHpa.toFixed(1)} hPa.`,
			raw: {
				pressureHpa,
				elevationMeters: Number.isFinite(elevationMeters)
					? elevationMeters
					: null,
				gpsAltitudeMeters: gpsAltitude ?? null,
				agreesWithGpsAltitude: agrees ?? null,
			},
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const denied =
			message.toLowerCase().includes('permission') ||
			message.toLowerCase().includes('not allowed')
		return makeSignal({
			id: 'barometer',
			label,
			status: denied ? 'denied' : 'error',
			confidence: 0,
			summary: denied
				? 'Permissão de barômetro negada.'
				: `Falha no barômetro: ${message}`,
			raw: { error: message },
		})
	}
}
