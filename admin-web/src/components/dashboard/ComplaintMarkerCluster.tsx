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
    const markers = complaints.filter(
      (c) => c.latitude != null && c.longitude != null
    )

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 56,
      disableClusteringAtZoom: 21,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) =>
        createClusterIcon(cluster, categoriesCtx.resolve),
    })

    const popupRoots = popupRootsRef.current

    for (const complaint of markers) {
      const catalog = categoriesCtx.resolve(complaint.category)
      const { iconKey, color } = resolveCategoryDisplay(complaint, catalog)
      const marker = L.marker([complaint.latitude!, complaint.longitude!], {
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
