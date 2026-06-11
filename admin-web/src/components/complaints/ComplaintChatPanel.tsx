import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComplaintDetail } from '../../api/admin/complaints'
import {
  countUnreadCitizenMessages,
  fetchComplaintMessages,
  markComplaintMessagesRead,
  postComplaintMessage,
  type ComplaintChatMessage,
} from '../../api/admin/complaintMessages'
import styles from './ComplaintChatPanel.module.css'

type ComplaintChatPanelProps = {
  complaint: ComplaintDetail
  canSend: boolean
}

export function ComplaintChatPanel({
  complaint,
  canSend,
}: ComplaintChatPanelProps) {
  const [messages, setMessages] = useState<ComplaintChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const disabled = !complaint.created_by

  const loadMessages = useCallback(async () => {
    if (disabled) {
      setLoading(false)
      return
    }
    try {
      const list = await fetchComplaintMessages(complaint.id)
      setMessages(list)
      setError(null)

      const unread = countUnreadCitizenMessages(list)
      if (unread > 0) {
        await markComplaintMessagesRead(complaint.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar conversa.')
    } finally {
      setLoading(false)
    }
  }, [complaint.id, disabled])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (disabled) return
    pollRef.current = setInterval(() => {
      void loadMessages()
    }, 30_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [disabled, loadMessages])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !canSend || sending || disabled) return

    setSending(true)
    setError(null)
    try {
      const msg = await postComplaintMessage(complaint.id, body)
      setMessages((prev) => [...prev, msg])
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  if (disabled) {
    return (
      <p className={styles.muted}>
        Esta ocorrência não tem autor registado — chat indisponível.
      </p>
    )
  }

  const unread = countUnreadCitizenMessages(messages)

  return (
    <div className={styles.panel}>
      {unread > 0 ? (
        <p className={styles.unreadBadge} role="status">
          {unread} mensagem(ns) não lida(s) do cidadão
        </p>
      ) : null}

      <div className={styles.messageList} ref={listRef}>
        {loading ? (
          <p className={styles.muted}>A carregar conversa…</p>
        ) : messages.length === 0 ? (
          <p className={styles.muted}>
            Nenhuma mensagem ainda. Inicie a conversa com o cidadão.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.sender_type === 'municipality'
                  ? styles.bubbleMunicipality
                  : styles.bubbleCitizen
              }
            >
              <span className={styles.sender}>{msg.display_name}</span>
              <p className={styles.body}>{msg.body}</p>
              <time className={styles.time} dateTime={msg.created_at}>
                {formatTime(msg.created_at)}
              </time>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {canSend ? (
        <form className={styles.form} onSubmit={handleSend}>
          <textarea
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva uma mensagem ao cidadão…"
            rows={3}
            maxLength={2000}
            disabled={sending}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={sending || !text.trim()}
          >
            {sending ? 'A enviar…' : 'Enviar'}
          </button>
        </form>
      ) : (
        <p className={styles.muted}>
          Modo leitura — apenas operadores podem enviar mensagens.
        </p>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export { countUnreadCitizenMessages }
