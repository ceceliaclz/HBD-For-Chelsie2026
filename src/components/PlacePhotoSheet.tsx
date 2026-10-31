import { useEffect, useRef, useState } from 'react'
import type { Place } from '../domain/types'
import { visitorLabel } from '../domain/roleLabels'

interface DraftPhoto {
  file: File
  url: string
  picked: boolean
}

export function PlacePhotoSheet({
  place,
  onClose,
  onAddPhotos,
  onVisitedOnChange,
}: {
  place: Place
  onClose: () => void
  onAddPhotos: (files: File[]) => void
  onVisitedOnChange: (visitedOn: string) => void
}) {
  const photos = place.photos ?? []
  const [drafts, setDrafts] = useState<DraftPhoto[]>([])
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const pickedCount = drafts.filter((draft) => draft.picked).length

  useEffect(() => () => {
    draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.url))
  }, [])

  function stageFiles(files: File[]) {
    if (!files.length) return
    setDrafts((current) => [
      ...current,
      ...files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        picked: false,
      })),
    ])
  }

  function toggleDraft(url: string) {
    setDrafts((current) => current.map((draft) => (
      draft.url === url ? { ...draft, picked: !draft.picked } : draft
    )))
  }

  function confirmDrafts() {
    const files = drafts.filter((draft) => draft.picked).map((draft) => draft.file)
    drafts.forEach((draft) => URL.revokeObjectURL(draft.url))
    setDrafts([])
    if (files.length) onAddPhotos(files)
  }

  return (
    <section className="place-sheet" aria-label={place.name}>
      <div className="place-sheet__grab" />
      <h2>{place.name}</h2>
      <p className="place-sheet__meta">{visitorLabel(place.visitor)}</p>
      <label className="place-sheet__date">
        <span>到访日期，可以改</span>
        <input
          type="date"
          value={place.visitedOn ?? ''}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => onVisitedOnChange(event.target.value)}
        />
      </label>
      {photos.length === 0 ? (
        <p className="place-sheet__empty">待添加</p>
      ) : (
        <div className={photos.length > 1 ? 'place-sheet__pile' : 'place-sheet__film'} aria-label={`${photos.length} 张照片`}>
          {photos.map((photo, index) => (
            <img key={`${index}-${photo.slice(-24)}`} src={photo} alt="" />
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="photo-picks" aria-label="点选要留下的照片">
          <p>点一下要留下的，再添加</p>
          <div>
            {drafts.map((draft) => (
              <button
                key={draft.url}
                type="button"
                className="photo-pick"
                aria-pressed={draft.picked}
                onClick={() => toggleDraft(draft.url)}
              >
                <img src={draft.url} alt="" />
                <span>{draft.picked ? '已选' : '点选'}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="place-sheet__add"
            disabled={pickedCount === 0}
            onClick={confirmDrafts}
          >
            添加选中的 {pickedCount} 张
          </button>
        </div>
      )}
      <label className="place-sheet__add">
        从相册挑选
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ''
            stageFiles(files)
          }}
        />
      </label>
      <button type="button" className="place-sheet__close" onClick={onClose}>关闭</button>
    </section>
  )
}
