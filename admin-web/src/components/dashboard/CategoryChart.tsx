import { useMemo, useState } from 'react'
import type { CategoryItem } from '../../api/admin/analytics'
import { CategoryIcon } from '../../catalog/CategoryIcon'
import { useCategories } from '../../catalog/CategoriesContext'
import styles from './CategoryChart.module.css'

type CategoryChartProps = {
  items: CategoryItem[]
  loading: boolean
  selectedCategory?: string | null
  onSelectCategory?: (slug: string) => void
}

type PieSlice = CategoryItem & {
  startAngle: number
  endAngle: number
}

const PIE_SIZE = 160
const PIE_RADIUS = 68
const PIE_CENTER = PIE_SIZE / 2

function polarToCartesian(
  center: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: center + radius * Math.cos(angleRad),
    y: center + radius * Math.sin(angleRad),
  }
}

function describeSlice(
  startAngle: number,
  endAngle: number,
  radius: number,
  center: number
): string {
  if (endAngle - startAngle >= 359.99) {
    return [
      `M ${center} ${center}`,
      `m -${radius}, 0`,
      `a ${radius},${radius} 0 1,0 ${radius * 2},0`,
      `a ${radius},${radius} 0 1,0 -${radius * 2},0`,
      'Z',
    ].join(' ')
  }

  const start = polarToCartesian(center, radius, endAngle)
  const end = polarToCartesian(center, radius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${center} ${center}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function buildSlices(items: CategoryItem[]): PieSlice[] {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return []

  let cursor = 0

  return items.map((item) => {
    const startAngle = (cursor / total) * 360
    cursor += item.count
    const endAngle = (cursor / total) * 360
    return { ...item, startAngle, endAngle }
  })
}

export function CategoryChart({
  items,
  loading,
  selectedCategory = null,
  onSelectCategory,
}: CategoryChartProps) {
  const { resolve } = useCategories()
  const [hoverSlug, setHoverSlug] = useState<string | null>(null)
  const slices = useMemo(() => buildSlices(items), [items])
  const total = items.reduce((sum, item) => sum + item.count, 0)

  const handleSelect = (slug: string) => {
    onSelectCategory?.(slug)
  }

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Distribuição por categoria</h2>
      {loading ? (
        <p className={styles.empty}>A carregar…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sem dados de categorias.</p>
      ) : (
        <div className={styles.layout}>
          <div className={styles.pieWrap}>
            <svg
              className={styles.pie}
              viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
              role="img"
              aria-label={`Gráfico de pizza com ${items.length} categorias`}
            >
              {slices.map((slice) => {
                const catalog = resolve(slice.slug)
                const colorHex =
                  slice.colorHex || catalog?.colorHex || '#BDBDBD'
                const isHighlighted =
                  hoverSlug === null || hoverSlug === slice.slug
                const isSelected = selectedCategory === slice.slug
                const isDimmed =
                  selectedCategory != null
                    ? selectedCategory !== slice.slug
                    : !isHighlighted

                return (
                  <path
                    key={slice.slug}
                    d={describeSlice(
                      slice.startAngle,
                      slice.endAngle,
                      PIE_RADIUS,
                      PIE_CENTER
                    )}
                    fill={colorHex}
                    className={`${styles.slice} ${isDimmed ? styles.sliceDimmed : ''} ${isSelected ? styles.sliceSelected : ''}`}
                    onMouseEnter={() => setHoverSlug(slice.slug)}
                    onMouseLeave={() => setHoverSlug(null)}
                    onFocus={() => setHoverSlug(slice.slug)}
                    onBlur={() => setHoverSlug(null)}
                    onClick={() => handleSelect(slice.slug)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleSelect(slice.slug)
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <title>
                      {slice.name}: {slice.count} ({slice.percent}%)
                    </title>
                  </path>
                )
              })}
              <circle
                cx={PIE_CENTER}
                cy={PIE_CENTER}
                r={36}
                className={styles.pieHole}
              />
              <text
                x={PIE_CENTER}
                y={PIE_CENTER - 4}
                textAnchor="middle"
                className={styles.pieTotal}
              >
                {total}
              </text>
              <text
                x={PIE_CENTER}
                y={PIE_CENTER + 12}
                textAnchor="middle"
                className={styles.pieTotalLabel}
              >
                total
              </text>
            </svg>
          </div>

          <ul className={styles.legend}>
            {items.map((item) => {
              const catalog = resolve(item.slug)
              const colorHex = item.colorHex || catalog?.colorHex || '#BDBDBD'
              const label = item.name || catalog?.name || item.category
              const iconKey = item.iconKey || catalog?.iconKey
              const isHighlighted =
                hoverSlug === null || hoverSlug === item.slug
              const isSelected = selectedCategory === item.slug
              const isDimmed =
                selectedCategory != null
                  ? selectedCategory !== item.slug
                  : !isHighlighted

              return (
                <li
                  key={item.slug}
                  className={`${styles.legendItem} ${isDimmed ? styles.legendDimmed : ''} ${isSelected ? styles.legendSelected : ''}`}
                  onMouseEnter={() => setHoverSlug(item.slug)}
                  onMouseLeave={() => setHoverSlug(null)}
                  onClick={() => handleSelect(item.slug)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelect(item.slug)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <span
                    className={styles.legendSwatch}
                    style={{ backgroundColor: colorHex }}
                    aria-hidden
                  />
                  <CategoryIcon
                    iconKey={iconKey}
                    size={14}
                    color={colorHex}
                  />
                  <span className={styles.legendLabel}>{label}</span>
                  <span className={styles.legendValue}>
                    {item.count}{' '}
                    <span className={styles.legendPercent}>
                      ({item.percent}%)
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
