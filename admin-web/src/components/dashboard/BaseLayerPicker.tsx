import { useEffect, useRef, useState } from 'react'
import {
  BASE_LAYERS,
  getBaseLayer,
  type BaseLayerId,
} from './baseLayers'
import styles from './BaseLayerPicker.module.css'

type BaseLayerPickerProps = {
  activeId: BaseLayerId
  onChange: (id: BaseLayerId) => void
}

export function BaseLayerPicker({ activeId, onChange }: BaseLayerPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = getBaseLayer(activeId)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Camada base: ${active.name}. Clique para alterar.`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.triggerPreview} aria-hidden>
          <img src={active.previewUrl} alt="" className={styles.previewImg} />
        </span>
        <span className={styles.triggerText}>
          <span className={styles.triggerLabel}>Camada</span>
          <span className={styles.triggerName}>{active.name}</span>
        </span>
        <span className={styles.chevron} aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open ? (
        <div className={styles.panel} role="listbox" aria-label="Camadas base">
          <p className={styles.panelTitle}>Camada base</p>
          <div className={styles.grid}>
            {BASE_LAYERS.map((layer) => {
              const selected = layer.id === activeId
              return (
                <button
                  key={layer.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.option} ${selected ? styles.optionActive : ''}`}
                  onClick={() => {
                    onChange(layer.id)
                    setOpen(false)
                  }}
                >
                  <span className={styles.optionPreview}>
                    <img
                      src={layer.previewUrl}
                      alt=""
                      className={styles.previewImg}
                      loading="lazy"
                    />
                    {selected ? (
                      <span className={styles.check} aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.optionName}>{layer.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
