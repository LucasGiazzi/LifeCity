import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { createCategoryMarkerIcon } from '../../catalog/categoryMarkerIcon'
import { complaintMarkerColor } from '../../catalog/categoryUtils'
import styles from './ComplaintLocationMap.module.css'

type ComplaintLocationMapProps = {
  latitude: number
  longitude: number
  color?: string
  iconKey?: string | null
}

export function ComplaintLocationMap({
  latitude,
  longitude,
  color = '#00c896',
  iconKey,
}: ComplaintLocationMapProps) {
  const fillColor = complaintMarkerColor(color, color)
  const icon = createCategoryMarkerIcon(iconKey, fillColor, 34)

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
        <Marker position={[latitude, longitude]} icon={icon} />
      </MapContainer>
    </div>
  )
}
