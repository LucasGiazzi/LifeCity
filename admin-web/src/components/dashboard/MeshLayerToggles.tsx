import styles from './MeshLayerToggles.module.css'

type MeshLayerTogglesProps = {
  showBairros: boolean
  showSetores: boolean
  onToggleBairros: (value: boolean) => void
  onToggleSetores: (value: boolean) => void
  bairrosAvailable: boolean
  setoresAvailable: boolean
}

export function MeshLayerToggles({
  showBairros,
  showSetores,
  onToggleBairros,
  onToggleSetores,
  bairrosAvailable,
  setoresAvailable,
}: MeshLayerTogglesProps) {
  return (
    <div className={styles.panel}>
      <label className={styles.item}>
        <input type="checkbox" checked disabled readOnly />
        <span>Município</span>
      </label>
      <label className={styles.item}>
        <input
          type="checkbox"
          checked={showBairros}
          disabled={!bairrosAvailable}
          onChange={(e) => onToggleBairros(e.target.checked)}
        />
        <span>Bairros</span>
      </label>
      <label className={styles.item}>
        <input
          type="checkbox"
          checked={showSetores}
          disabled={!setoresAvailable}
          onChange={(e) => onToggleSetores(e.target.checked)}
        />
        <span>Setores</span>
      </label>
    </div>
  )
}
