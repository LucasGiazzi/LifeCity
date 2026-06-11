import L from 'leaflet'
import 'leaflet.markercluster'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMap } from 'react-leaflet'
import type { ComplaintPoint } from '../../api/admin/complaints'
import { CategoriesContext, useCategories } from '../../catalog/CategoriesContext'
import { createCategoryMarkerIcon } from '../../catalog/categoryMarkerIcon'
import { resolveCategoryDisplay } from '../../catalog/categoryUtils'
import {
  COMPLAINT_POPUP_CLASS,
  ComplaintMapPopup,
} from './ComplaintMapPopup'

function schedulePopupResize(marker: L.Marker) {
  requestAnimationFrame(() => {
    marker.getPopup()?.update()
    requestAnimationFrame(() => marker.getPopup()?.update())
  })
}

function mountComplaintPopup(
  marker: L.Marker,
  complaint: ComplaintPoint,
  categoriesCtx: ReturnType<typeof useCategories>,
  popupRoots: Map<L.Marker, Root>,
  onViewDetails: (id: number) => void
) {
  const popup = marker.getPopup()
  if (!popup) return

  let container = popup.getContent()
  if (!(container instanceof HTMLElement)) {
    container = document.createElement('div')
    popup.setContent(container)
  }

  let root = popupRoots.get(marker)
  if (!root) {
    root = createRoot(container)
    popupRoots.set(marker, root)
  }

  root.render(
    <CategoriesContext.Provider value={categoriesCtx}>
      <ComplaintMapPopup
        complaint={complaint}
        onViewDetails={onViewDetails}
      />
    </CategoriesContext.Provider>
  )

  schedulePopupResize(marker)
}

type ComplaintMarker = L.Marker & { complaint?: ComplaintPoint }

/** ~4 m — separa marcadores com coordenadas idênticas para permitir clique/spiderfy */
const DUPLICATE_OFFSET_METERS = 4

function groupByLocation(
  items: ComplaintPoint[]
): Map<string, ComplaintPoint[]> {
  const groups = new Map<string, ComplaintPoint[]>()

  for (const item of items) {
    const lat = item.latitude!
    const lng = item.longitude!
    const key = `${lat.toFixed(7)},${lng.toFixed(7)}`
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }

  return groups
}

function offsetLatLng(
  lat: number,
  lng: number,
  index: number,
  total: number
): [number, number] {
  if (total <= 1) {
    return [lat, lng]
  }

  const angle = (2 * Math.PI * index) / total
  const latMeters = DUPLICATE_OFFSET_METERS * Math.cos(angle)
  const lngMeters = DUPLICATE_OFFSET_METERS * Math.sin(angle)
  const latOffset = latMeters / 111_000
  const lngOffset =
    lngMeters / (111_000 * Math.cos((lat * Math.PI) / 180))

  return [lat + latOffset, lng + lngOffset]
}

function markersShareExactLocation(markers: L.Marker[]): boolean {
  if (markers.length < 2) return false
  const first = markers[0].getLatLng()
  return markers.every((marker) => marker.getLatLng().equals(first))
}

function dominantCategoryColor(
  markers: ComplaintMarker[],
  resolve: ReturnType<typeof useCategories>['resolve']
): string {
  const counts = new Map<string, number>()
  const colors = new Map<string, string>()

  for (const marker of markers) {
    const complaint = marker.complaint
    if (!complaint) continue

    const catalog = resolve(complaint.category)
    const { color } = resolveCategoryDisplay(complaint, catalog)
    const key = complaint.category?.trim() || 'outros'

    counts.set(key, (counts.get(key) ?? 0) + 1)
    colors.set(key, color)
  }

  let topKey = 'outros'
  let topCount = 0
  for (const [key, count] of counts) {
    if (count > topCount) {
      topCount = count
      topKey = key
    }
  }

  return colors.get(topKey) ?? '#78909C'
}

function createClusterIcon(
  cluster: L.MarkerCluster,
  resolve: ReturnType<typeof useCategories>['resolve']
): L.DivIcon {
  const count = cluster.getChildCount()
  const markers = cluster.getAllChildMarkers() as ComplaintMarker[]
  const color = dominantCategoryColor(markers, resolve)
  const size = count < 10 ? 36 : count < 50 ? 42 : 48

  return L.divIcon({
    className: 'lc-cluster-marker-wrap',
    html: `<div class="lc-cluster-marker" style="--cluster-color:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

type ComplaintMarkerClusterProps = {
  complaints: ComplaintPoint[]
}

export function ComplaintMarkerCluster({
  complaints,
}: ComplaintMarkerClusterProps) {
  const map = useMap()
  const navigate = useNavigate()
  const categoriesCtx = useCategories()
  const popupRootsRef = useRef<Map<L.Marker, Root>>(new Map())

  useEffect(() => {
    const onViewDetails = (id: number) => {
      navigate(`/admin/complaints/${id}`)
    }
    const located = complaints.filter(
      (c) => c.latitude != null && c.longitude != null
    )
    const locationGroups = groupByLocation(located)

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 56,
      disableClusteringAtZoom: 18,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyDistanceMultiplier: 1.6,
      iconCreateFunction: (cluster) =>
        createClusterIcon(cluster, categoriesCtx.resolve),
    })

    clusterGroup.on('clusterclick', (event) => {
      const cluster = event.layer as L.MarkerCluster
      const childMarkers = cluster.getAllChildMarkers()
      if (childMarkers.length > 1 && markersShareExactLocation(childMarkers)) {
        cluster.spiderfy()
      }
    })

    const popupRoots = popupRootsRef.current

    for (const [, group] of locationGroups) {
      group.forEach((complaint, index) => {
        const catalog = categoriesCtx.resolve(complaint.category)
        const { iconKey, color } = resolveCategoryDisplay(complaint, catalog)
        const [lat, lng] = offsetLatLng(
          complaint.latitude!,
          complaint.longitude!,
          index,
          group.length
        )
        const marker = L.marker([lat, lng], {
          icon: createCategoryMarkerIcon(iconKey, color),
        }) as ComplaintMarker

        marker.complaint = complaint

        marker.bindPopup(document.createElement('div'), {
          className: COMPLAINT_POPUP_CLASS,
          minWidth: 280,
          maxWidth: 300,
        })

        marker.on('popupopen', () => {
          mountComplaintPopup(
            marker,
            complaint,
            categoriesCtx,
            popupRoots,
            onViewDetails
          )
        })

        clusterGroup.addLayer(marker)
      })
    }

    map.addLayer(clusterGroup)

    return () => {
      for (const root of popupRoots.values()) {
        root.unmount()
      }
      popupRoots.clear()
      map.removeLayer(clusterGroup)
      clusterGroup.clearLayers()
    }
  }, [map, complaints, categoriesCtx, navigate])

  return null
}
