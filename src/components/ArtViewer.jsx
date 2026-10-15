import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import { RichText } from './RichText.jsx'

// Full-screen viewer: arrow keys / buttons step through, Escape closes,
// and "Full screen" hides everything but the art (for showing the table).
function ArtViewer({ piece, position, onStep, onClose, actions }) {
  const stageRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (document.querySelector('.modal__backdrop')) return // an edit dialog is on top
      if (event.key === 'Escape' && !document.fullscreenElement) onClose()
      if (event.key === 'ArrowRight') onStep?.(1)
      if (event.key === 'ArrowLeft') onStep?.(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onStep])

  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

  return (
    <div className="art-viewer" role="dialog" aria-modal="true" aria-label={piece.title || 'Campaign art'}>
      <div className="art-viewer__bar">
        <div className="art-viewer__heading">
          <h3 className="art-viewer__title">{piece.title || 'Untitled'}</h3>
          <span className="art-viewer__meta">
            {piece.category} · {position}
          </span>
        </div>
        <div className="art-viewer__bar-actions">
          {canFullscreen && (
            <button type="button" className="btn btn--text" onClick={() => stageRef.current?.requestFullscreen?.()}>
              <Icon name="maximize" /> Full screen
            </button>
          )}
          <button ref={closeRef} type="button" className="btn btn--text" onClick={onClose} aria-label="Close viewer">
            ✕
          </button>
        </div>
      </div>

      <div className="art-viewer__stage" ref={stageRef}>
        <img src={piece.url} alt={piece.title || 'Campaign art'} />
        {onStep && (
          <>
            <button type="button" className="art-viewer__nav art-viewer__nav--prev" onClick={() => onStep(-1)} aria-label="Previous piece">
              ‹
            </button>
            <button type="button" className="art-viewer__nav art-viewer__nav--next" onClick={() => onStep(1)} aria-label="Next piece">
              ›
            </button>
          </>
        )}
      </div>

      {(piece.notes || actions) && (
        <div className="art-viewer__footer">
          {piece.notes && <RichText className="art-viewer__notes" value={piece.notes} />}
          {actions && <div className="art-viewer__actions">{actions}</div>}
        </div>
      )}
    </div>
  )
}

export default ArtViewer
