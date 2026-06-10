import styles from './SetorRankingChart.module.css'
import type { AreaRankItem } from '../../api/admin/analytics'

export type AreaRankingMode = 'bairro' | 'setor'

type SetorRankingChartProps = {
  items: AreaRankItem[]
  mode: AreaRankingMode
  onModeChange: (mode: AreaRankingMode) => void
  canToggleMode: boolean
  selectedCode: string | null
  areasLoaded: boolean
  loading: boolean
  onSelectArea: (code: string) => void
  onClearSelection: () => void
}

export function SetorRankingChart({
  items,
  mode,
  onModeChange,
  canToggleMode,
  selectedCode,
  areasLoaded,
  loading,
  onSelectArea,
  onClearSelection,
}: SetorRankingChartProps) {
  const max = items.reduce((acc, item) => Math.max(acc, item.count), 0)
  const modeLabel = mode === 'bairro' ? 'bairro' : 'setor'
  const modeLabelPlural = mode === 'bairro' ? 'bairros' : 'setores'

  if (loading) {
    return (
      <section className={styles.wrap}>
        <p className={styles.empty}>A carregar ranking…</p>
      </section>
    )
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Ranking por {mode === 'bairro' ? 'bairro' : 'setor'}
          </h2>
          <p className={styles.hint}>
            Clique num {modeLabel} para filtrar o mapa e os demais gráficos.
          </p>
        </div>
        <div className={styles.headerActions}>
          {canToggleMode ? (
            <div
              className={styles.modeToggle}
              role="group"
              aria-label="Alternar ranking por bairro ou setor"
            >
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'bairro' ? styles.modeBtnActive : ''}`}
                onClick={() => onModeChange('bairro')}
                aria-pressed={mode === 'bairro'}
              >
                Bairros
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === 'setor' ? styles.modeBtnActive : ''}`}
                onClick={() => onModeChange('setor')}
                aria-pressed={mode === 'setor'}
              >
                Setores
              </button>
            </div>
          ) : null}
          {selectedCode ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={onClearSelection}
            >
              Limpar filtro
            </button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {areasLoaded
            ? `Nenhuma ocorrência com ${modeLabel} identificado.`
            : `Malha de ${modeLabelPlural} em carga.`}
        </p>
      ) : (
        <ul
          className={styles.list}
          role="listbox"
          aria-label={`Ranking de ${modeLabelPlural}`}
        >
          {items.map((item, index) => {
            const selected = selectedCode === item.code
            const width = max > 0 ? (item.count / max) * 100 : 0

            return (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
                  onClick={() => onSelectArea(item.code)}
                >
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.label} title={item.label}>
                    {item.label}
                  </span>
                  <span className={styles.barTrack} aria-hidden>
                    <span
                      className={styles.barFill}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className={styles.count}>{item.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
