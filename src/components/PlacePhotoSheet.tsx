import { useEffect, useRef, useState } from 'react'
import type { Place } from '../domain/types'
import { visitorLabel } from '../domain/roleLabels'
import { isWish, wishMark } from '../domain/wishes'

interface DraftPhoto {
  file: File
  url: string
}

export function PlacePhotoSheet({
  place,
  onClose,
  onAddPhotos,
  onVisitedOnChange,
  onMakeVisited,
}: {
  place: Place
  onClose: () => void
  onAddPhotos: (files: File[]) => void
  onVisitedOnChange: (visitedOn: string) => void
  onMakeVisited: () => void
}) {
  const photos = place.photos ?? []
  const [drafts, setDrafts] = useState<DraftPhoto[]>([])
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
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
      })),
    ])
  }

  function confirmDrafts() {
    const files = drafts.map((draft) => draft.file)
    drafts.forEach((draft) => URL.revokeObjectURL(draft.url))
    setDrafts([])
    if (files.length) onAddPhotos(files)
  }

  return (
    <section className="place-sheet" aria-label={place.name}>
      <div className="place-sheet__grab" />
      <h2>{place.name}</h2>
      <p className="place-sheet__meta">
        {isWish(place)
          ? wishMark(place)
          : visitorLabel(place.visitor)}
      </p>
      {isWish(place) && (
        <p className="place-sheet__empty">{place.wishNote?.trim() || '还没写为什么想去'}</p>
      )}
      {!isWish(place) && place.wishNote?.trim() && (
        <p className="place-sheet__empty">{place.wishNote.trim()}</p>
      )}
      {isWish(place) ? (
        <>
          <button type="button" className="place-sheet__add" onClick={onMakeVisited}>记成去过</button>
          <button type="button" className="place-sheet__close" onClick={onClose}>关闭</button>
        </>
      ) : (
        <>
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
        <div className="photo-picks" aria-label="即将添加的照片">
          <p>已从相册选好 {drafts.length} 张</p>
          <div>
            {drafts.map((draft) => (
              <img key={draft.url} src={draft.url} alt="" />
            ))}
          </div>
          <button type="button" className="place-sheet__add" onClick={confirmDrafts}>
            确认添加
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
        </>
      )}
    </section>
  )
}
