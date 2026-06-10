import styles from './MeshLayerToggles.module.css'
import type { MeshDivision } from './DashboardMap'

type MeshLayerTogglesProps = {
  meshDivision: MeshDivision
  onMeshDivisionChange: (value: MeshDivision) => void
  bairrosAvailable: boolean
  setoresAvailable: boolean
}

export function MeshLayerToggles({
  meshDivision,
  onMeshDivisionChange,
  bairrosAvailable,
  setoresAvailable,
}: MeshLayerTogglesProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.heading}>Divisão territorial</span>
      <label className={styles.item}>
        <input type="checkbox" checked disabled readOnly />
        <span>Município</span>
      </label>
      <label className={styles.item}>
        <input
          type="radio"
          name="mesh-division"
          checked={meshDivision === null}
          onChange={() => onMeshDivisionChange(null)}
        />
        <span>Nenhuma</span>
      </label>
      <label className={styles.item}>
        <input
          type="radio"
          name="mesh-division"
          checked={meshDivision === 'bairros'}
          disabled={!bairrosAvailable}
          onChange={() => onMeshDivisionChange('bairros')}
        />
        <span>Bairros</span>
      </label>
      <label className={styles.item}>
        <input
          type="radio"
          name="mesh-division"
          checked={meshDivision === 'setores'}
          disabled={!setoresAvailable}
          onChange={() => onMeshDivisionChange('setores')}
        />
        <span>Setores</span>
      </label>
    </div>
  )
}
