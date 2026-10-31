import { useEffect, useState, type FormEvent } from 'react'
import type { Place, Role, Visitor } from '../domain/types'
import { visitorEmoji, visitorLabel } from '../domain/roleLabels'
import { isWish, wishMark } from '../domain/wishes'
import { formatCityLabel, searchCities } from '../geo/citySearch'
import type { PlaceSelection } from './AddPlaceSheet'

const VISITORS: Visitor[] = ['rabbit', 'dog', 'together']

export interface WishSheetProps {
  open: boolean
  places: Place[]
  memberRole?: Role
  onClose(): void
  onAdd(hit: PlaceSelection, visitor: Visitor, note?: string): Promise<void>
  onOpen(place: Place): void
}

export function WishSheet({
  open,
  places,
  memberRole,
  onClose,
  onAdd,
  onOpen,
}: WishSheetProps) {
  const wishes = places.filter(isWish)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PlaceSelection | null>(null)
  const [visitor, setVisitor] = useState<Visitor>(memberRole ?? 'together')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const results = searchCities(query)

  useEffect(() => {
    if (!open) return
    setAdding(false)
    setQuery('')
    setSelected(null)
    setVisitor(memberRole ?? 'together')
    setNote('')
    setSaving(false)
    setSaveError('')
  }, [open, memberRole])

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await onAdd(selected, visitor, note.trim() || undefined)
      setAdding(false)
      setQuery('')
      setSelected(null)
      setNote('')
    } catch {
      setSaveError('这次没记上，过一会儿再试')
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
        aria-labelledby="wish-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="add-place-sheet__handle" aria-hidden="true" />
        <header className="add-place-sheet__header">
          <div>
            <p>{adding ? '还没去' : '想去的地方'}</p>
            <h2 id="wish-sheet-title">{adding ? '添加心愿' : '心愿单'}</h2>
          </div>
          <button type="button" className="sheet-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        {adding ? (
          <form onSubmit={submit}>
            <label className="place-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                autoFocus
                placeholder="搜索想去的城市或国家"
                aria-label="搜索想去的城市或国家"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelected(null)
                }}
              />
            </label>
            <div className="city-results" aria-label="心愿搜索结果">
              {query && results.length === 0 && (
                <p className="city-results__empty">没找到这个地点，试试城市名或国家名</p>
              )}
              {results.map((hit) => {
                const pressed = selected?.name === hit.name && selected.countryCode === hit.countryCode
                return (
                  <button
                    type="button"
                    key={`${hit.countryCode}-${hit.name}`}
                    className="city-result"
                    aria-pressed={pressed}
                    onClick={() => setSelected({ ...hit, placeType: 'city' })}
                  >
                    <span className="city-result__pin">♡</span>
                    <span><strong>{formatCityLabel(hit)}</strong><small>{hit.countryName}</small></span>
                    <span aria-hidden="true">{pressed ? '✓' : '›'}</span>
                  </button>
                )
              })}
            </div>
            <fieldset className="visitor-picker">
              <legend>谁想去？</legend>
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
              <span>为什么想去（可选）</span>
              <input
                type="text"
                value={note}
                maxLength={80}
                placeholder="一句话就好"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <button className="light-place-button" type="submit" disabled={!selected || saving}>
              {saving ? '正在记下…' : '记下心愿'}
            </button>
            <button type="button" className="sheet-text-button" onClick={() => setAdding(false)}>
              返回心愿单
            </button>
          </form>
        ) : (
          <>
            <div className="city-results" aria-label="心愿列表">
              {wishes.length === 0 && (
                <p className="city-results__empty">还没有想去的地方</p>
              )}
              {wishes.map((place) => (
                <button
                  type="button"
                  key={place.id}
                  className="city-result"
                  onClick={() => onOpen(place)}
                >
                  <span className="city-result__pin">♡</span>
                  <span>
                    <strong>{place.name}</strong>
                    <small>
                      {wishMark(place)}
                      {place.wishNote?.trim() ? ` · ${place.wishNote.trim()}` : ''}
                    </small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
            <button type="button" className="light-place-button" onClick={() => setAdding(true)}>
              添加心愿
            </button>
          </>
        )}
      </section>
    </div>
  )
}
