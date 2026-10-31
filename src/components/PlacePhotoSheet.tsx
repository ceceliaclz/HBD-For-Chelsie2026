import type { Place } from '../domain/types'
import { visitorLabel } from '../domain/roleLabels'

export function PlacePhotoSheet({
  place,
  onClose,
  onAddPhotos,
}: {
  place: Place
  onClose: () => void
  onAddPhotos: (files: File[]) => void
}) {
  const photos = place.photos ?? []
  return (
    <section className="place-sheet" aria-label={place.name}>
      <div className="place-sheet__grab" />
      <h2>{place.name}</h2>
      <p className="place-sheet__meta">
        {visitorLabel(place.visitor)}
        {place.visitedOn ? ` · ${place.visitedOn}` : ' · 没写时间'}
      </p>
      {photos.length === 0 ? (
        <p className="place-sheet__empty">待添加</p>
      ) : (
        <div className="place-sheet__film">
          {photos.map((photo) => (
            <img key={photo.slice(-24)} src={photo} alt="" />
          ))}
        </div>
      )}
      <label className="place-sheet__add">
        添加照片
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ''
            if (files.length) onAddPhotos(files)
          }}
        />
      </label>
      <button type="button" className="place-sheet__close" onClick={onClose}>关闭</button>
    </section>
  )
}
