import { useEffect, useState, type FormEvent } from 'react'
import type { Visitor } from '../domain/types'
import { searchCities, type CityHit } from '../geo/citySearch'

const VISITORS: Array<{ value: Visitor; label: string; icon: string }> = [
  { value: 'rabbit', label: '兔子', icon: '🐰' },
  { value: 'dog', label: '小狗', icon: '🐶' },
  { value: 'together', label: '一起', icon: '♥' },
]

export interface AddPlaceSheetProps {
  open: boolean
  onClose(): void
  defaultVisitor: Visitor
  onSubmit(hit: CityHit, visitor: Visitor, visitedOn?: string): Promise<void>
}

export function AddPlaceSheet({
  open,
  onClose,
  defaultVisitor,
  onSubmit,
}: AddPlaceSheetProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CityHit | null>(null)
  const [visitor, setVisitor] = useState<Visitor>(defaultVisitor)
  const [visitedOn, setVisitedOn] = useState('')
  const [saving, setSaving] = useState(false)
  const results = searchCities(query)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(null)
    setVisitor(defaultVisitor)
    setVisitedOn('')
    setSaving(false)
  }, [open, defaultVisitor])

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    try {
      await onSubmit(selected, visitor, visitedOn || undefined)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="add-place-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="add-place-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="add-place-sheet__handle" aria-hidden="true" />
        <header className="add-place-sheet__header">
          <div>
            <p>NEW MEMORY</p>
            <h2 id="add-place-title">点亮一座城市</h2>
          </div>
          <button type="button" className="sheet-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        <form onSubmit={submit}>
          <label className="place-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              autoFocus
              placeholder="搜索城市或国家"
              aria-label="搜索城市或国家"
              onChange={(event) => {
                setQuery(event.target.value)
                setSelected(null)
              }}
            />
          </label>

          <div className="city-results" aria-label="城市搜索结果">
            {query && results.length === 0 && (
              <p className="city-results__empty">还没有找到这座城</p>
            )}
            {results.map((hit) => (
              <button
                type="button"
                key={`${hit.countryCode}-${hit.name}`}
                className="city-result"
                aria-pressed={selected === hit}
                onClick={() => setSelected(hit)}
              >
                <span className="city-result__pin">✦</span>
                <span><strong>{hit.name}</strong><small>{hit.countryName}</small></span>
                <span aria-hidden="true">{selected === hit ? '✓' : '›'}</span>
              </button>
            ))}
          </div>

          <fieldset className="visitor-picker">
            <legend>谁去过这里？</legend>
            <div>
              {VISITORS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`visitor-choice visitor-choice--${item.value}`}
                  aria-pressed={visitor === item.value}
                  onClick={() => setVisitor(item.value)}
                >
                  <span aria-hidden="true">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="date-field">
            <span>到访日期（可选）</span>
            <input
              type="date"
              value={visitedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setVisitedOn(event.target.value)}
            />
          </label>

          <button className="light-place-button" type="submit" disabled={!selected || saving}>
            <span aria-hidden="true">✦</span>{saving ? '正在点亮…' : '点亮'}
          </button>
        </form>
      </section>
    </div>
  )
}
