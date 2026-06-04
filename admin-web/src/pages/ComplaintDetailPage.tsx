import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAdminComplaintDetail,
  type ComplaintDetail,
  type ComplaintPhoto,
} from '../api/admin/complaints'
import { ComplaintLocationMap } from '../components/complaints/ComplaintLocationMap'
import {
  categoryIconLabel,
  complaintMarkerColor,
} from '../catalog/categoryUtils'
import { useCategories } from '../catalog/CategoriesContext'
import {
  formatDate,
  formatDateTime,
  statusLabel,
} from '../utils/format'
import styles from './ComplaintDetailPage.module.css'

export function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { resolve } = useCategories()
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null)
  const [photos, setPhotos] = useState<ComplaintPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const complaintId = Number(id)
    if (!Number.isFinite(complaintId)) {
      setError('Identificador inválido.')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAdminComplaintDetail(complaintId)
        if (cancelled) return
        setComplaint(data.complaint)
        setPhotos(data.photos)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Erro ao carregar ocorrência.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>A carregar ocorrência…</p>
      </div>
    )
  }

  if (error || !complaint) {
    return (
      <div className={styles.page}>
        <Link to="/admin" className={styles.backLink}>
          ← Voltar ao dashboard
        </Link>
        <p className={styles.error} role="alert">
          {error ?? 'Ocorrência não encontrada.'}
        </p>
      </div>
    )
  }

  const catalog = resolve(complaint.category)
  const categoryName =
    complaint.category_name ??
    catalog?.name ??
    complaint.category ??
    'Sem categoria'
  const color = complaintMarkerColor(
    complaint.category_color,
    catalog?.colorHex
  )
  const icon = categoryIconLabel(
    complaint.category_icon ?? catalog?.iconKey
  )
  const hasCoords =
    complaint.latitude != null && complaint.longitude != null

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link to="/admin" className={styles.backLink}>
          ← Dashboard
        </Link>
        <span className={styles.ref}>Ocorrência #{complaint.id}</span>
      </header>

      <section
        className={styles.hero}
        style={{
          background: `linear-gradient(135deg, ${color}22 0%, rgba(255,255,255,0.95) 55%, #fff 100%)`,
          borderColor: `${color}35`,
        }}
      >
        <div className={styles.heroMain}>
          <span
            className={styles.categoryChip}
            style={{
              background: `${color}20`,
              color,
              borderColor: `${color}45`,
            }}
          >
            <span aria-hidden>{icon}</span>
            {categoryName}
          </span>
          <h1 className={styles.title}>{categoryName}</h1>
          <p className={styles.heroMeta}>
            Ocorrência em {formatDate(complaint.occurrence_date)} · Registada{' '}
            {formatDateTime(complaint.created_at)}
          </p>
        </div>
        <div className={styles.heroAside}>
          <span className={styles.statusBadge}>{statusLabel(complaint.status)}</span>
          {complaint.is_within_city === false ? (
            <span className={styles.warningBadge}>Fora do município</span>
          ) : null}
        </div>
      </section>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Descrição</h2>
            <p className={styles.description}>
              {complaint.description?.trim() || 'Sem descrição registada.'}
            </p>
          </article>

          {photos.length > 0 ? (
            <article className={styles.card}>
              <h2 className={styles.cardTitle}>
                Fotos
                <span className={styles.count}>{photos.length}</span>
              </h2>
              <div className={styles.photoGrid}>
                {photos.map((photo) => (
                  <a
                    key={photo.path}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.photoLink}
                  >
                    <img
                      src={photo.url}
                      alt={`Foto da ocorrência ${complaint.id}`}
                      className={styles.photo}
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </article>
          ) : null}

          {hasCoords ? (
            <article className={styles.card}>
              <h2 className={styles.cardTitle}>Localização</h2>
              {complaint.address ? (
                <p className={styles.address}>{complaint.address}</p>
              ) : null}
              <ComplaintLocationMap
                latitude={complaint.latitude!}
                longitude={complaint.longitude!}
                color={color}
              />
              <p className={styles.coords}>
                {complaint.latitude!.toFixed(6)},{' '}
                {complaint.longitude!.toFixed(6)}
              </p>
            </article>
          ) : null}

          <article className={`${styles.card} ${styles.managementCard}`}>
            <h2 className={styles.cardTitle}>Gestão</h2>
            <p className={styles.managementHint}>
              Em breve: atribuição a equipe, alteração de status, prazos SLA e
              histórico de ações nesta ocorrência.
            </p>
            <div className={styles.managementActions}>
              <button type="button" className={styles.actionBtn} disabled>
                Atribuir responsável
              </button>
              <button type="button" className={styles.actionBtn} disabled>
                Alterar status
              </button>
              <button type="button" className={styles.actionBtn} disabled>
                Registar nota interna
              </button>
            </div>
          </article>
        </div>

        <aside className={styles.sideCol}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Cidadão</h2>
            <dl className={styles.dl}>
              <div className={styles.row}>
                <dt>Nome</dt>
                <dd>{complaint.reporter_name ?? '—'}</dd>
              </div>
              <div className={styles.row}>
                <dt>E-mail</dt>
                <dd>
                  {complaint.reporter_email ? (
                    <a href={`mailto:${complaint.reporter_email}`}>
                      {complaint.reporter_email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className={styles.row}>
                <dt>Telefone</dt>
                <dd>{complaint.reporter_phone ?? '—'}</dd>
              </div>
            </dl>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Territorial</h2>
            <dl className={styles.dl}>
              <div className={styles.row}>
                <dt>Município</dt>
                <dd>{complaint.cd_mun ?? '—'}</dd>
              </div>
              <div className={styles.row}>
                <dt>Bairro</dt>
                <dd>
                  {complaint.bairro_name
                    ? `${complaint.bairro_name}${complaint.cd_bairro ? ` (${complaint.cd_bairro})` : ''}`
                    : (complaint.cd_bairro ?? '—')}
                </dd>
              </div>
              <div className={styles.row}>
                <dt>Setor censitário</dt>
                <dd>{complaint.cd_setor ?? '—'}</dd>
              </div>
            </dl>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Metadados</h2>
            <dl className={styles.dl}>
              <div className={styles.row}>
                <dt>ID</dt>
                <dd>{complaint.id}</dd>
              </div>
              <div className={styles.row}>
                <dt>Status</dt>
                <dd>{statusLabel(complaint.status)}</dd>
              </div>
              <div className={styles.row}>
                <dt>Data da ocorrência</dt>
                <dd>{formatDate(complaint.occurrence_date)}</dd>
              </div>
              <div className={styles.row}>
                <dt>Criada em</dt>
                <dd>{formatDateTime(complaint.created_at)}</dd>
              </div>
              <div className={styles.row}>
                <dt>Dentro do município</dt>
                <dd>
                  {complaint.is_within_city == null
                    ? '—'
                    : complaint.is_within_city
                      ? 'Sim'
                      : 'Não'}
                </dd>
              </div>
            </dl>
          </article>
        </aside>
      </div>
    </div>
  )
}
