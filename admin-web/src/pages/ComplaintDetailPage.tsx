import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchAdminComplaintDetail,
  type ComplaintDetail,
  type ComplaintPhoto,
} from '../api/admin/complaints'
import { ComplaintManagementPanel } from '../components/complaints/ComplaintManagementPanel'
import { ComplaintLocationMap } from '../components/complaints/ComplaintLocationMap'
import { CategoryIcon } from '../catalog/CategoryIcon'
import { resolveCategoryDisplay } from '../catalog/categoryUtils'
import { useCategories } from '../catalog/CategoriesContext'
import { useTenant } from '../auth/useTenant'
import {
  formatDate,
  formatDateTime,
  statusColor,
  statusLabel,
} from '../utils/format'
import styles from './ComplaintDetailPage.module.css'

export function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { resolve } = useCategories()
  const { activeTenant } = useTenant()
  const canEdit =
    activeTenant?.role === 'operator' ||
    activeTenant?.role === 'admin' ||
    activeTenant?.role === 'owner'
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
  const { name: categoryName, iconKey, color } = resolveCategoryDisplay(
    complaint,
    catalog
  )
  const statusTint = statusColor(complaint.status)
  const hasCoords =
    complaint.latitude != null && complaint.longitude != null

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link to="/admin/inbox" className={styles.backLink}>
          ← Inbox
        </Link>
      </header>

      <section
        className={styles.hero}
        style={{ borderColor: `${color}30` }}
      >
        <div
          className={styles.heroFade}
          aria-hidden
          style={{
            background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${statusTint}12 40%, ${statusTint}38 100%)`,
          }}
        />
        <div className={styles.heroBody}>
          <div className={styles.heroHeadline}>
            <span
              className={styles.iconWrap}
              style={{ background: `${color}18`, color }}
            >
              <CategoryIcon iconKey={iconKey} size={34} color={color} />
            </span>
            <h1 className={styles.title}>{categoryName}</h1>
            <span className={styles.occurrenceRef}>
              Ocorrência #{complaint.id}
            </span>
          </div>
          <p className={styles.heroMeta}>
            Ocorrência em {formatDate(complaint.occurrence_date)} · Registada{' '}
            {formatDateTime(complaint.created_at)}
          </p>
          {complaint.is_within_city === false ? (
            <span className={styles.warningBadge}>Fora do município</span>
          ) : null}
        </div>
        <div className={styles.heroStatus}>
          <span
            className={styles.statusBadge}
            style={{
              color: statusTint,
              background: `${statusTint}22`,
              borderColor: `${statusTint}40`,
            }}
          >
            {statusLabel(complaint.status)}
          </span>
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
                iconKey={iconKey}
              />
              <p className={styles.coords}>
                {complaint.latitude!.toFixed(6)},{' '}
                {complaint.longitude!.toFixed(6)}
              </p>
            </article>
          ) : null}

          <article className={`${styles.card} ${styles.managementCard}`}>
            <h2 className={styles.cardTitle}>Gestão</h2>
            <ComplaintManagementPanel
              complaint={complaint}
              canEdit={canEdit}
              onUpdated={setComplaint}
            />
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
                <dt>Prioridade</dt>
                <dd>{complaint.priority ?? '—'}</dd>
              </div>
              <div className={styles.row}>
                <dt>Equipe</dt>
                <dd>{complaint.assigned_ops_team_name ?? '—'}</dd>
              </div>
              <div className={styles.row}>
                <dt>SLA</dt>
                <dd>
                  {complaint.sla_due_at
                    ? formatDateTime(complaint.sla_due_at)
                    : '—'}
                </dd>
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
