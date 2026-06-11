import { Link, useLocation } from 'react-router-dom'
import styles from '../../pages/platform/platformPage.module.css'

type Props = {
  tenantId: string
}

export function TenantTabs({ tenantId }: Props) {
  const { pathname } = useLocation()
  const base = `/platform/tenants/${tenantId}`

  const isResumo = pathname === base
  const isMembros = pathname === `${base}/members`
  const isCidadaos = pathname === `${base}/citizens`

  return (
    <div className={styles.tabs}>
      <Link
        to={base}
        className={isResumo ? styles.tabActive : styles.tab}
      >
        Resumo
      </Link>
      <Link
        to={`${base}/members`}
        className={isMembros ? styles.tabActive : styles.tab}
      >
        Membros
      </Link>
      <Link
        to={`${base}/citizens`}
        className={isCidadaos ? styles.tabActive : styles.tab}
      >
        Cidadãos
      </Link>
    </div>
  )
}
