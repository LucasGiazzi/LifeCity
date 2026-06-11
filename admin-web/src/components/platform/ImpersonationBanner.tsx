import { usePlatform } from '../../auth/usePlatform'
import styles from './ImpersonationBanner.module.css'

export function ImpersonationBanner() {
  const {
    isImpersonating,
    impersonatedTenantName,
    exitImpersonation,
    isExiting,
  } = usePlatform()

  if (!isImpersonating) return null

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        ⚠ Modo suporte — {impersonatedTenantName ?? 'Município'}
      </span>
      <button
        type="button"
        className={styles.exitBtn}
        onClick={() => void exitImpersonation()}
        disabled={isExiting}
      >
        {isExiting ? 'A sair…' : 'Sair do município'}
      </button>
    </div>
  )
}
