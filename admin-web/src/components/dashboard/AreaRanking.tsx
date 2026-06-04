import styles from './AreaRanking.module.css'
import type { AreaRankItem } from '../../api/admin/analytics'

type AreaRankingProps = {
  bySetor: AreaRankItem[]
  byBairro: AreaRankItem[]
  setoresLoaded: boolean
  bairrosLoaded: boolean
  loading: boolean
}

function RankingTable({
  title,
  items,
  emptyHint,
}: {
  title: string
  items: AreaRankItem[]
  emptyHint: string
}) {
  return (
    <div className={styles.tableWrap}>
      <h3 className={styles.subtitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.empty}>{emptyHint}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Área</th>
              <th>Qtd.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code}>
                <td>{item.label}</td>
                <td>{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function AreaRanking({
  bySetor,
  byBairro,
  setoresLoaded,
  bairrosLoaded,
  loading,
}: AreaRankingProps) {
  if (loading) {
    return <p className={styles.loading}>A carregar rankings…</p>
  }

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Top áreas</h2>
      <div className={styles.grid}>
        <RankingTable
          title="Top setores"
          items={bySetor}
          emptyHint={
            setoresLoaded
              ? 'Nenhuma reclamação com setor identificado.'
              : 'Malha de setores em carga.'
          }
        />
        <RankingTable
          title="Top bairros"
          items={byBairro}
          emptyHint={
            bairrosLoaded
              ? 'Nenhuma reclamação com bairro identificado.'
              : 'Malha de bairros em carga.'
          }
        />
      </div>
    </section>
  )
}
