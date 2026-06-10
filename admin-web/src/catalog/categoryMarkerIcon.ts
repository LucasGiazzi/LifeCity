import L from 'leaflet'
import { categoryIconSvgMarkup } from './categoryIconPaths'

const MARKER_SIZE = 30
const ICON_SIZE = 16

export function createCategoryMarkerIcon(
  iconKey: string | null | undefined,
  color: string,
  size = MARKER_SIZE
): L.DivIcon {
  const iconSize = Math.round(size * (ICON_SIZE / MARKER_SIZE))

  return L.divIcon({
    className: 'lc-category-marker-wrap',
    html: `<div class="lc-category-marker" style="--marker-color:${color};width:${size}px;height:${size}px">${categoryIconSvgMarkup(iconKey, iconSize, '#ffffff')}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  })
}
