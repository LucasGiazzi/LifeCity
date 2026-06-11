import { useState } from 'react'
import styles from './CopySetupLink.module.css'

type CopySetupLinkProps = {
  setupLink: string
  emailSent?: boolean
  compact?: boolean
}

export function CopySetupLink({
  setupLink,
  emailSent,
  compact = false,
}: CopySetupLinkProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(setupLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={compact ? styles.compact : styles.wrap}>
      {emailSent != null ? (
        <span
          className={
            emailSent ? styles.badgeSent : styles.badgeManual
          }
        >
          {emailSent ? 'E-mail enviado' : 'Envie manualmente'}
        </span>
      ) : null}
      {!compact ? (
        <p className={styles.link} title={setupLink}>
          {setupLink}
        </p>
      ) : null}
      <button type="button" className={styles.copyBtn} onClick={handleCopy}>
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}
