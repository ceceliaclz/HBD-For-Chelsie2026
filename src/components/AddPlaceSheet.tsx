import { useEffect, useState, type FormEvent } from 'react'
import type { Visitor } from '../domain/types'
import { formatCityLabel, searchCities, type CityHit } from '../geo/citySearch'
import { visitorEmoji, visitorLabel } from '../domain/roleLabels'

const VISITORS: Visitor[] = ['rabbit', 'dog', 'together']

export interface AddPlaceSheetProps {
  open: boolean
  onClose(): void
  defaultVisitor: Visitor
  initialPlace?: PlaceSelection | null
  onSubmit(hit: PlaceSelection, visitor: Visitor, visitedOn?: string): Promise<void>
}

export interface PlaceSelection extends CityHit {
  placeType: 'country' | 'city'
}

export function AddPlaceSheet({
  open,
  onClose,
  defaultVisitor,
  initialPlace,
  onSubmit,
}: AddPlaceSheetProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PlaceSelection | null>(null)
  const [visitor, setVisitor] = useState<Visitor>(defaultVisitor)
  const [visitedOn, setVisitedOn] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const results = searchCities(query)
  const selectedMatchesResults = selected?.placeType === 'city'
    && results.some((hit) => (
      hit.name === selected.name && hit.countryCode === selected.countryCode
    ))

  useEffect(() => {
    if (!open) return
    setQuery(initialPlace?.name ?? '')
    setSelected(initialPlace ?? null)
    setVisitor(defaultVisitor)
    setVisitedOn('')
    setSaving(false)
    setSaveError('')
  }, [open, defaultVisitor, initialPlace])

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await onSubmit(selected, visitor, visitedOn || undefined)
      onClose()
    } catch {
      setSaveError('这次没能点亮，请检查网络后再试')
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
              placeholder="搜索城市（中文/英文）或国家"
              aria-label="搜索城市（中文或英文）或国家"
              onChange={(event) => {
                setQuery(event.target.value)
                setSelected(null)
              }}
            />
          </label>

          <div className="city-results" aria-label="城市搜索结果">
            {query && results.length === 0 && (
              <p className="city-results__empty">
                没找到这个地点，试试城市名或国家名
              </p>
            )}
            {selected && !selectedMatchesResults && (
              <button
                type="button"
                className="city-result"
                aria-pressed="true"
                onClick={() => setSelected(selected)}
              >
                <span className="city-result__pin">✦</span>
                <span><strong>{formatCityLabel(selected)}</strong><small>{selected.countryName}</small></span>
                <span aria-hidden="true">✓</span>
              </button>
            )}
            {results.map((hit) => (
              <button
                type="button"
                key={`${hit.countryCode}-${hit.name}`}
                className="city-result"
                aria-pressed={
                  selected?.placeType === 'city'
                  && selected.name === hit.name
                  && selected.countryCode === hit.countryCode
                }
                onClick={() => setSelected({ ...hit, placeType: 'city' })}
              >
                <span className="city-result__pin">✦</span>
                <span><strong>{formatCityLabel(hit)}</strong><small>{hit.countryName}</small></span>
                <span aria-hidden="true">{
                  selected?.placeType === 'city'
                  && selected.name === hit.name
                  && selected.countryCode === hit.countryCode
                    ? '✓'
                    : '›'
                }</span>
              </button>
            ))}
          </div>

          <fieldset className="visitor-picker">
            <legend>谁去过这里？</legend>
            <div>
              {VISITORS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`visitor-choice visitor-choice--${item}`}
                  aria-pressed={visitor === item}
                  onClick={() => setVisitor(item)}
                >
                  <span aria-hidden="true">{visitorEmoji(item)}</span>{visitorLabel(item)}
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

          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <button className="light-place-button" type="submit" disabled={!selected || saving}>
            <span aria-hidden="true">✦</span>{saving ? '正在点亮…' : '点亮'}
          </button>
        </form>
      </section>
    </div>
  )
}
