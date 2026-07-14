import { Fragment, useEffect, useState } from 'react'

import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'

import type {
	FusedLocation,
	LocationSignal,
	ProbeId,
} from '@features/location/api/location.schema'
import {
	FUSED_COLOR,
	probeColor,
	shortProbeLabel,
} from '@features/location/lib/probe-colors'
import {
	CAMERA_ACCURACY_MAX_METERS,
	type SignalMapPoint,
	cameraFocusLatLngs,
	shouldDrawAccuracyCircle,
	signalMapPoints,
} from '@features/location/lib/signal-map-points'

interface LocationMapProps {
	readonly fused?: FusedLocation | undefined
	readonly signals: readonly LocationSignal[]
	readonly selectedSignalIds: readonly ProbeId[]
	readonly isCollecting: boolean
	readonly panelOpen: boolean
	readonly onToggleSignal: (id: ProbeId) => void
}

const DEFAULT_CENTER: LatLngExpression = [-14.235, -51.925]
const DEFAULT_ZOOM = 3

function createProbeIcon(
	color: string,
	selected: boolean,
	approximate: boolean,
): L.DivIcon {
	const size = selected ? 16 : approximate ? 10 : 12
	return L.divIcon({
		className: 'locatone-marker-probe',
		html: `<span class="locatone-pin locatone-pin--probe${selected ? ' locatone-pin--selected' : ''}${approximate && !selected ? ' locatone-pin--approx' : ''}" style="--pin-color:${color};width:${String(size)}px;height:${String(size)}px"></span>`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	})
}

const fusedIcon = L.divIcon({
	className: 'locatone-marker-fused',
	html: `<span class="locatone-pin locatone-pin--fused" style="--pin-color:${FUSED_COLOR}"></span>`,
	iconSize: [18, 18],
	iconAnchor: [9, 9],
})

function flyZoomForPoint(point: SignalMapPoint): number {
	const accuracy = point.accuracyMeters
	if (point.approximate) {
		return 4
	}
	if (accuracy !== undefined && accuracy > CAMERA_ACCURACY_MAX_METERS) {
		return 4
	}
	if (accuracy !== undefined && accuracy < 5_000) {
		return 13
	}
	return 8
}

function MapEffects({
	fused,
	points,
	selectedIds,
	panelOpen,
}: {
	readonly fused?: FusedLocation | undefined
	readonly points: readonly SignalMapPoint[]
	readonly selectedIds: readonly ProbeId[]
	readonly panelOpen: boolean
}) {
	const map = useMap()

	useEffect(() => {
		map.invalidateSize()
	}, [map, panelOpen])

	useEffect(() => {
		const selectedPoints = points.filter(point =>
			selectedIds.includes(point.signal.id),
		)

		if (selectedPoints.length === 1) {
			const only = selectedPoints[0]
			if (only !== undefined) {
				map.flyTo([only.lat, only.lng], flyZoomForPoint(only), {
					duration: 0.8,
				})
			}
			return
		}

		if (selectedPoints.length > 1) {
			const bounds = L.latLngBounds(
				selectedPoints.map(point => [point.lat, point.lng]),
			)
			map.fitBounds(bounds, {
				padding: [48, 48],
				maxZoom: 12,
				animate: true,
				duration: 0.8,
			})
			return
		}

		const focus = cameraFocusLatLngs(points, fused, selectedIds)
		if (focus.length === 0) {
			return
		}

		if (focus.length === 1) {
			const only = focus[0]
			if (only !== undefined) {
				const zoom =
					fused?.accuracyMeters !== undefined && fused.accuracyMeters < 5_000
						? 13
						: 5
				map.flyTo([only.lat, only.lng], zoom, { duration: 1.1 })
			}
			return
		}

		const bounds = L.latLngBounds(focus.map(point => [point.lat, point.lng]))
		map.fitBounds(bounds, {
			padding: [48, 48],
			maxZoom: 12,
			animate: true,
			duration: 1.1,
		})
	}, [fused, map, points, selectedIds])

	return null
}

function MapLegend({
	points,
	panelOpen,
}: {
	readonly points: readonly SignalMapPoint[]
	readonly panelOpen: boolean
}) {
	const [expanded, setExpanded] = useState(!panelOpen)

	useEffect(() => {
		setExpanded(!panelOpen)
	}, [panelOpen])

	if (points.length === 0) {
		return null
	}

	const seen = new Set<ProbeId>()
	const entries: { readonly id: ProbeId; readonly color: string }[] = []
	for (const point of points) {
		if (seen.has(point.signal.id)) {
			continue
		}
		seen.add(point.signal.id)
		entries.push({ id: point.signal.id, color: probeColor(point.signal.id) })
	}

	return (
		<div className='pointer-events-auto absolute bottom-3 left-3 z-[400] max-w-[min(calc(100%-1.5rem),22rem)]'>
			{panelOpen ? (
				<button
					type='button'
					onClick={() => {
						setExpanded(current => !current)
					}}
					aria-expanded={expanded}
					className='mb-1.5 rounded-lg border border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_88%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--loc-accent)] backdrop-blur-md focus-visible:ring-2 focus-visible:ring-[var(--loc-accent)] focus-visible:outline-none'
				>
					{expanded ? 'Ocultar legenda' : 'Legenda'}
				</button>
			) : null}
			{expanded || !panelOpen ? (
				<div
					className={`rounded-lg border border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_88%,transparent)] px-2.5 py-2 backdrop-blur-md ${
						panelOpen ? 'max-h-24 overflow-y-auto sm:max-h-none' : ''
					}`}
				>
					<p className='mb-1.5 text-[10px] font-semibold tracking-wide text-[var(--loc-muted)] uppercase'>
						Métodos no mapa
					</p>
					<ul className='flex flex-wrap gap-x-3 gap-y-1.5'>
						{entries.map(entry => (
							<li
								key={entry.id}
								className='flex items-center gap-1.5 text-[11px] text-[var(--loc-ink)]'
							>
								<span
									className='size-2.5 shrink-0 rounded-full'
									style={{ backgroundColor: entry.color }}
									aria-hidden
								/>
								{shortProbeLabel(entry.id)}
							</li>
						))}
						<li className='flex items-center gap-1.5 text-[11px] text-[var(--loc-ink)]'>
							<span
								className='size-2.5 shrink-0 rounded-full ring-2 ring-[var(--loc-ink)]/30'
								style={{ backgroundColor: FUSED_COLOR }}
								aria-hidden
							/>
							Fusão
						</li>
					</ul>
				</div>
			) : null}
		</div>
	)
}

export function LocationMap({
	fused,
	signals,
	selectedSignalIds,
	isCollecting,
	panelOpen,
	onToggleSignal,
}: LocationMapProps) {
	const points = signalMapPoints(signals)
	const center: LatLngExpression =
		fused?.lat !== undefined && fused.lng !== undefined
			? [fused.lat, fused.lng]
			: points[0] !== undefined
				? [points[0].lat, points[0].lng]
				: DEFAULT_CENTER

	return (
		<div
			className={`absolute inset-0 z-0 transition-opacity duration-700 ${
				isCollecting ? 'opacity-70' : 'opacity-100'
			}`}
		>
			{isCollecting ? (
				<div className='pointer-events-none absolute inset-x-0 top-0 z-[400] h-0.5 overflow-hidden'>
					<div className='locatone-scan-line h-full w-1/3 bg-[var(--loc-accent)]' />
				</div>
			) : null}
			<MapContainer
				center={center}
				zoom={DEFAULT_ZOOM}
				className='h-full w-full bg-[var(--loc-bg)]'
				zoomControl={false}
				attributionControl
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
					url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
				/>
				<MapEffects
					fused={fused}
					points={points}
					selectedIds={selectedSignalIds}
					panelOpen={panelOpen}
				/>
				{points.map(point => {
					const color = probeColor(point.signal.id)
					const selectedPoint = selectedSignalIds.includes(point.signal.id)
					const drawCircle = shouldDrawAccuracyCircle(point, selectedPoint)
					return (
						<Fragment key={point.signal.id}>
							{drawCircle && point.accuracyMeters !== undefined ? (
								<Circle
									center={[point.lat, point.lng]}
									radius={point.accuracyMeters}
									pathOptions={{
										color,
										fillColor: color,
										fillOpacity: selectedPoint ? 0.06 : 0.03,
										weight: selectedPoint ? 2 : 1,
										opacity: selectedPoint ? 0.85 : 0.4,
									}}
									eventHandlers={{
										click: () => {
											onToggleSignal(point.signal.id)
										},
									}}
								/>
							) : null}
							<Marker
								position={[point.lat, point.lng]}
								icon={createProbeIcon(color, selectedPoint, point.approximate)}
								opacity={selectedPoint ? 1 : point.approximate ? 0.55 : 0.75}
								eventHandlers={{
									click: () => {
										onToggleSignal(point.signal.id)
									},
								}}
								title={`${point.signal.label}${point.approximate ? ' (aprox.)' : ''}`}
							/>
						</Fragment>
					)
				})}
				{fused?.lat !== undefined && fused.lng !== undefined ? (
					<>
						{fused.accuracyMeters !== undefined ? (
							<Circle
								center={[fused.lat, fused.lng]}
								radius={fused.accuracyMeters}
								pathOptions={{
									color: FUSED_COLOR,
									fillColor: FUSED_COLOR,
									fillOpacity: 0.06,
									weight: 1.5,
									opacity: 0.75,
								}}
							/>
						) : null}
						<Marker position={[fused.lat, fused.lng]} icon={fusedIcon} />
					</>
				) : null}
			</MapContainer>
			<MapLegend points={points} panelOpen={panelOpen} />
		</div>
	)
}
