import { Link } from 'react-router-dom'
import type { ComplaintPoint } from '../../api/admin/complaints'
import { categoryIconLabel, complaintMarkerColor } from '../../catalog/categoryUtils'
import { useCategories } from '../../catalog/CategoriesContext'
import { formatDate, statusLabel, truncateAddress } from '../../utils/format'
import styles from './ComplaintMapPopup.module.css'

type ComplaintMapPopupProps = {
  complaint: ComplaintPoint
}

export function ComplaintMapPopup({ complaint }: ComplaintMapPopupProps) {
  const { resolve } = useCategories()
  const catalog = resolve(complaint.category)
  const categoryName =
    complaint.category_name ?? catalog?.name ?? complaint.category ?? 'Sem categoria'
  const color = complaintMarkerColor(
    complaint.category_color,
    catalog?.colorHex
  )
  const icon = categoryIconLabel(
    complaint.category_icon ?? catalog?.iconKey
  )
  const dateLabel = formatDate(complaint.created_at)

  return (
    <div className={styles.popup}>
      <div
        className={styles.accent}
        style={{ background: color }}
        aria-hidden
      />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <span
            className={styles.categoryChip}
            style={{
              background: `${color}18`,
              color,
              borderColor: `${color}40`,
            }}
          >
            <span className={styles.chipIcon} aria-hidden>
              {icon}
            </span>
            {categoryName}
          </span>
          <span className={styles.status}>{statusLabel(complaint.status)}</span>
        </div>
        <p className={styles.meta}>
          <span className={styles.metaLabel}>Registada em</span>
          {dateLabel}
        </p>
        {complaint.address ? (
          <p className={styles.address}>{truncateAddress(complaint.address)}</p>
        ) : null}
        <Link
          to={`/admin/complaints/${complaint.id}`}
          className={styles.cta}
        >
          Ver detalhes
        </Link>
      </div>
    </div>
  )
}

export const COMPLAINT_POPUP_CLASS = 'complaint-map-popup'
