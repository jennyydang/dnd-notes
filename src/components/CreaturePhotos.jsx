import { useEffect, useRef, useState } from 'react'
import { getPublicUrl } from '../lib/storage.js'
import { CREATURE_BUCKET, MAX_CREATURE_PHOTOS, photoList } from '../lib/creatures.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import './CreaturePhotos.scss'

// The form's photo field: thumbnails with ×, and "Add photos" (several at once).
export function PhotoPicker({ items, onChange, id = 'creature-photos' }) {
  const inputRef = useRef(null)
  const items$ = useRef(items)
  items$.current = items
  // Previews of picked files are object URLs; free them when they go.
  useEffect(
    () => () => items$.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)),
    [],
  )

  function add(files) {
    const room = MAX_CREATURE_PHOTOS - items.length
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room))
    onChange([...items, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function remove(index) {
    const item = items[index]
    if (item.preview) URL.revokeObjectURL(item.preview)
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="photo-picker">
      <span className="photo-picker__label" id={`${id}-label`}>
        Photos
      </span>
      <ul className="photo-picker__grid" aria-labelledby={`${id}-label`}>
        {items.map((item, i) => (
          <li key={item.path || item.preview} className="photo-picker__item">
            <img src={item.preview || getPublicUrl(CREATURE_BUCKET, item.path)} alt="" />
            {i === 0 && <span className="photo-picker__cover">Cover</span>}
            <button type="button" className="photo-picker__remove" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)}>
              <Icon name="close" />
            </button>
          </li>
        ))}
        {items.length < MAX_CREATURE_PHOTOS && (
          <li>
            <button type="button" className="photo-picker__add" onClick={() => inputRef.current?.click()}>
              <Icon name="plus" />
              <span>Add photos</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// On a card: the first photo large, the rest as a strip; tap any to open
// them full size and step through.
export function CreatureGallery({ photos, name }) {
  const list = photoList(photos)
  const [open, setOpen] = useState(null)
  if (!list.length) return null
  const url = (p) => getPublicUrl(CREATURE_BUCKET, p)

  return (
    <>
      <div className={`creature-gallery${list.length > 1 ? ' creature-gallery--many' : ''}`}>
        <button type="button" className="creature-gallery__cover" onClick={() => setOpen(0)} aria-label={`View photos of ${name}`}>
          <img src={url(list[0])} alt={name} loading="lazy" />
          {list.length > 1 && <span className="creature-gallery__count">{list.length} photos</span>}
        </button>
        {list.length > 1 && (
          <ul className="creature-gallery__thumbs">
            {list.slice(1, 5).map((p, i) => (
              <li key={p}>
                <button type="button" onClick={() => setOpen(i + 1)} aria-label={`Photo ${i + 2} of ${name}`}>
                  <img src={url(p)} alt="" loading="lazy" />
                  {i === 3 && list.length > 5 && <span className="creature-gallery__more">+{list.length - 5}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open !== null && <PhotoViewer photos={list.map(url)} start={open} name={name} onClose={() => setOpen(null)} />}
    </>
  )
}

function PhotoViewer({ photos, start, name, onClose }) {
  const [index, setIndex] = useState(start)
  const step = (d) => setIndex((i) => (i + d + photos.length) % photos.length)
  const touch = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length])

  return (
    <Modal onClose={onClose} label={`Photos of ${name}`} size="wide">
      <div
        className="photo-viewer"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touch.current ?? 0)
          if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1)
        }}
      >
        <img src={photos[index]} alt={`${name} — photo ${index + 1} of ${photos.length}`} />
        {photos.length > 1 && (
          <>
            <button type="button" className="photo-viewer__nav photo-viewer__nav--prev" aria-label="Previous photo" onClick={() => step(-1)}>
              <Icon name="prev" />
            </button>
            <button type="button" className="photo-viewer__nav photo-viewer__nav--next" aria-label="Next photo" onClick={() => step(1)}>
              <Icon name="next" />
            </button>
          </>
        )}
        <div className="photo-viewer__bar">
          <span>
            {name} · {index + 1} / {photos.length}
          </span>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
