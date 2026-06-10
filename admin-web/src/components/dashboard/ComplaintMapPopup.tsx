import { Link } from 'react-router-dom'
import type { ComplaintPoint } from '../../api/admin/complaints'
import { CategoryIcon } from '../../catalog/CategoryIcon'
import { resolveCategoryDisplay } from '../../catalog/categoryUtils'
import { useCategories } from '../../catalog/CategoriesContext'
import { formatDate, statusColor, statusLabel, truncateAddress } from '../../utils/format'
import styles from './ComplaintMapPopup.module.css'

type ComplaintMapPopupProps = {
  complaint: ComplaintPoint
  /** Popup Leaflet renderiza fora do Router — usar callback em vez de Link */
  onViewDetails?: (id: number) => void
}

export function ComplaintMapPopup({
  complaint,
  onViewDetails,
}: ComplaintMapPopupProps) {
  const { resolve } = useCategories()
  const catalog = resolve(complaint.category)
  const { name, iconKey, color } = resolveCategoryDisplay(complaint, catalog)
  const status = statusLabel(complaint.status)
  const statusTint = statusColor(complaint.status)
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
          <div className={styles.headline}>
            <span
              className={styles.iconWrap}
              style={{ background: `${color}18`, color }}
            >
              <CategoryIcon iconKey={iconKey} size={18} color={color} />
            </span>
            <span className={styles.categoryName}>{name}</span>
          </div>
          <span
            className={styles.status}
            style={{ color: statusTint }}
          >
            {status}
          </span>
        </div>
        <p className={styles.meta}>
          <span className={styles.metaLabel}>Registada em</span>
          {dateLabel}
        </p>
        {complaint.address ? (
          <p className={styles.address}>{truncateAddress(complaint.address)}</p>
        ) : null}
        {onViewDetails ? (
          <button
            type="button"
            className={styles.cta}
            onClick={() => onViewDetails(complaint.id)}
          >
            Ver detalhes
          </button>
        ) : (
          <Link
            to={`/admin/complaints/${complaint.id}`}
            className={styles.cta}
          >
            Ver detalhes
          </Link>
        )}
      </div>
    </div>
  )
}

export const COMPLAINT_POPUP_CLASS = 'complaint-map-popup'
