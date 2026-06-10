import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchComplaintCategories,
  type ComplaintCategory,
} from '../api/categories'
import { useAuth } from '../auth/useAuth'

type CategoriesContextValue = {
  categories: ComplaintCategory[]
  bySlug: Map<string, ComplaintCategory>
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  resolve: (slug: string | null | undefined) => ComplaintCategory | null
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

export { CategoriesContext }

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [categories, setCategories] = useState<ComplaintCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchComplaintCategories(Boolean(accessToken))
      setCategories(list)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar categorias.'
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  const bySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories]
  )

  const resolve = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return null
      return bySlug.get(slug.toLowerCase()) ?? bySlug.get(slug) ?? null
    },
    [bySlug]
  )

  const value = useMemo(
    () => ({
      categories,
      bySlug,
      loading,
      error,
      reload: load,
      resolve,
    }),
    [categories, bySlug, loading, error, load, resolve]
  )

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext)
  if (!ctx) {
    throw new Error('useCategories deve ser usado dentro de CategoriesProvider')
  }
  return ctx
}
