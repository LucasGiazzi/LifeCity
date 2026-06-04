import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { complaintMarkerColor } from '../../catalog/categoryUtils'
import styles from './ComplaintLocationMap.module.css'

type ComplaintLocationMapProps = {
  latitude: number
  longitude: number
  color?: string
}

export function ComplaintLocationMap({
  latitude,
  longitude,
  color = '#00c896',
}: ComplaintLocationMapProps) {
  const fillColor = complaintMarkerColor(color, color)

  return (
    <div className={styles.wrap}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        className={styles.map}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CircleMarker
          center={[latitude, longitude]}
          radius={10}
          pathOptions={{
            color: '#0d2818',
            fillColor,
            fillOpacity: 0.9,
            weight: 2,
          }}
        />
      </MapContainer>
    </div>
  )
}
