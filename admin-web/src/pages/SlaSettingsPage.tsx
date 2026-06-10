import { useCallback, useEffect, useState } from 'react'
import { useCategories } from '../catalog/CategoriesContext'
import {
  fetchSlaPolicies,
  saveSlaPolicies,
  type SlaPolicy,
} from '../api/admin/slaPolicies'
import styles from './AdminSettingsPage.module.css'

type EditablePolicy = {
  categoryId: string
  categoryName: string
  responseHours: number
  resolutionHours: number
  isActive: boolean
}

export function SlaSettingsPage() {
  const { categories } = useCategories()
  const [policies, setPolicies] = useState<EditablePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const mergePolicies = useCallback(
    (existing: SlaPolicy[]) => {
      return categories.map((cat) => {
        const found = existing.find((p) => p.categoryId === cat.id)
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          responseHours: found?.responseHours ?? 24,
          resolutionHours: found?.resolutionHours ?? 72,
          isActive: found?.isActive ?? true,
        }
      })
    },
    [categories]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSlaPolicies()
      setPolicies(mergePolicies(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar SLA.')
    } finally {
      setLoading(false)
    }
  }, [mergePolicies])

  useEffect(() => {
    if (categories.length > 0) {
      void load()
    }
  }, [load, categories.length])

  const updatePolicy = (
    categoryId: string,
    field: keyof EditablePolicy,
    value: number | boolean
  ) => {
    setPolicies((prev) =>
      prev.map((p) => (p.categoryId === categoryId ? { ...p, [field]: value } : p))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await saveSlaPolicies(
        policies.map((p) => ({
          categoryId: p.categoryId,
          responseHours: p.responseHours,
          resolutionHours: p.resolutionHours,
          isActive: p.isActive,
        }))
      )
      setSuccess('Políticas SLA guardadas. Prazos recalculados para ocorrências abertas.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar SLA.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Políticas de SLA</h1>
          <p className={styles.subtitle}>
            Prazos de resposta e resolução por categoria
          </p>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={saving || loading}
          onClick={() => void handleSave()}
        >
          Guardar alterações
        </button>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className={styles.muted}>{success}</p> : null}

      <div className={styles.card}>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Resposta (h)</th>
                <th>Resolução (h)</th>
                <th>Ativa</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.categoryId}>
                  <td>{policy.categoryName}</td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={policy.responseHours}
                      onChange={(e) =>
                        updatePolicy(
                          policy.categoryId,
                          'responseHours',
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={policy.resolutionHours}
                      onChange={(e) =>
                        updatePolicy(
                          policy.categoryId,
                          'resolutionHours',
                          parseInt(e.target.value, 10) || 1
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={policy.isActive}
                      onChange={(e) =>
                        updatePolicy(policy.categoryId, 'isActive', e.target.checked)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
