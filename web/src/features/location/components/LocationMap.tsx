import { Fragment, useEffect } from 'react'

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
	type SignalMapPoint,
	signalMapPoints,
} from '@features/location/lib/signal-map-points'

interface LocationMapProps {
	readonly fused?: FusedLocation | undefined
	readonly signals: readonly LocationSignal[]
	readonly selectedSignalId: ProbeId | null
	readonly isCollecting: boolean
	readonly panelOpen: boolean
	readonly onSelectSignal: (id: ProbeId) => void
}

const DEFAULT_CENTER: LatLngExpression = [-14.235, -51.925]
const DEFAULT_ZOOM = 3

function createProbeIcon(color: string, selected: boolean): L.DivIcon {
	const size = selected ? 16 : 12
	return L.divIcon({
		className: 'locatone-marker-probe',
		html: `<span class="locatone-pin locatone-pin--probe${selected ? ' locatone-pin--selected' : ''}" style="--pin-color:${color};width:${String(size)}px;height:${String(size)}px"></span>`,
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

function MapEffects({
	fused,
	points,
	selected,
	panelOpen,
}: {
	readonly fused?: FusedLocation | undefined
	readonly points: readonly SignalMapPoint[]
	readonly selected?: LocationSignal | undefined
	readonly panelOpen: boolean
}) {
	const map = useMap()

	useEffect(() => {
		map.invalidateSize()
	}, [map, panelOpen])

	useEffect(() => {
		if (selected?.lat !== undefined && selected.lng !== undefined) {
			map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 8), {
				duration: 0.8,
			})
			return
		}

		const selectedPoint = points.find(point => point.signal.id === selected?.id)
		if (selectedPoint !== undefined) {
			map.flyTo(
				[selectedPoint.lat, selectedPoint.lng],
				selectedPoint.approximate ? 4 : Math.max(map.getZoom(), 7),
				{ duration: 0.8 },
			)
			return
		}

		const latLngs: L.LatLngExpression[] = points.map(point => [
			point.lat,
			point.lng,
		])
		if (fused?.lat !== undefined && fused.lng !== undefined) {
			latLngs.push([fused.lat, fused.lng])
		}

		if (latLngs.length === 0) {
			return
		}

		if (latLngs.length === 1) {
			const only = latLngs[0]
			if (only !== undefined) {
				map.flyTo(
					only,
					fused?.accuracyMeters !== undefined && fused.accuracyMeters < 5_000
						? 13
						: 5,
					{
						duration: 1.1,
					},
				)
			}
			return
		}

		const bounds = L.latLngBounds(latLngs)
		map.fitBounds(bounds, {
			padding: [48, 48],
			maxZoom: 12,
			animate: true,
			duration: 1.1,
		})
	}, [fused, map, points, selected])

	return null
}

function MapLegend({ points }: { readonly points: readonly SignalMapPoint[] }) {
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
		<div className='pointer-events-auto absolute bottom-3 left-3 z-[400] max-w-[min(calc(100%-1.5rem),22rem)] rounded-lg border border-[var(--loc-border)] bg-[color-mix(in_oklab,var(--loc-bg)_88%,transparent)] px-2.5 py-2 backdrop-blur-md'>
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
						/>
						{shortProbeLabel(entry.id)}
					</li>
				))}
				<li className='flex items-center gap-1.5 text-[11px] text-[var(--loc-ink)]'>
					<span
						className='size-2.5 shrink-0 rounded-full ring-2 ring-[var(--loc-ink)]/30'
						style={{ backgroundColor: FUSED_COLOR }}
					/>
					Fusão
				</li>
			</ul>
		</div>
	)
}

export function LocationMap({
	fused,
	signals,
	selectedSignalId,
	isCollecting,
	panelOpen,
	onSelectSignal,
}: LocationMapProps) {
	const selected = signals.find(signal => signal.id === selectedSignalId)
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
					selected={selected}
					panelOpen={panelOpen}
				/>
				{points.map(point => {
					const color = probeColor(point.signal.id)
					const selectedPoint = selectedSignalId === point.signal.id
					return (
						<Fragment key={point.signal.id}>
							{point.accuracyMeters !== undefined ? (
								<Circle
									center={[point.lat, point.lng]}
									radius={point.accuracyMeters}
									pathOptions={{
										color,
										fillColor: color,
										fillOpacity: selectedPoint ? 0.14 : 0.06,
										weight: selectedPoint ? 2 : 1,
										opacity: selectedPoint ? 0.9 : 0.45,
									}}
									eventHandlers={{
										click: () => {
											onSelectSignal(point.signal.id)
										},
									}}
								/>
							) : null}
							<Marker
								position={[point.lat, point.lng]}
								icon={createProbeIcon(color, selectedPoint)}
								opacity={selectedPoint ? 1 : 0.75}
								eventHandlers={{
									click: () => {
										onSelectSignal(point.signal.id)
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
									fillOpacity: 0.08,
									weight: 1.5,
								}}
							/>
						) : null}
						<Marker position={[fused.lat, fused.lng]} icon={fusedIcon} />
					</>
				) : null}
			</MapContainer>
			<MapLegend points={points} />
		</div>
	)
}
