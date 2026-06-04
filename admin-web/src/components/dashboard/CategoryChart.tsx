import styles from './CategoryChart.module.css'
import type { CategoryItem } from '../../api/admin/analytics'
import { useCategories } from '../../catalog/CategoriesContext'

type CategoryChartProps = {
  items: CategoryItem[]
  loading: boolean
}

export function CategoryChart({ items, loading }: CategoryChartProps) {
  const { resolve } = useCategories()
  const max = items.reduce((acc, item) => Math.max(acc, item.count), 0)

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Distribuição por categoria</h2>
      {loading ? (
        <p className={styles.empty}>A carregar…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sem dados de categorias.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const catalog = resolve(item.slug)
            const colorHex = item.colorHex || catalog?.colorHex || '#BDBDBD'
            const label = item.name || catalog?.name || item.category
            return (
            <li key={item.slug} className={styles.row}>
              <div className={styles.meta}>
                <span className={styles.label}>
                  <span
                    className={styles.swatch}
                    style={{ backgroundColor: colorHex }}
                    aria-hidden
                  />
                  {label}
                </span>
                <span className={styles.count}>
                  {item.count} ({item.percent}%)
                </span>
              </div>
              <div className={styles.track}>
                <div
                  className={styles.bar}
                  style={{
                    width: max > 0 ? `${(item.count / max) * 100}%` : '0%',
                    backgroundColor: colorHex,
                  }}
                />
              </div>
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
