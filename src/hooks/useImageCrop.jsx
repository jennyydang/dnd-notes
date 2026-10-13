import { useRef, useState } from 'react'
import ImageCropDialog from '../components/ImageCropDialog.jsx'

// Puts the crop/zoom/move step between picking an image and using it.
//   const crop = useImageCrop({ aspect: 1, shape: 'circle', onCropped: (file) => … })
//   <input type="file" onChange={crop.fromInput} />   // pick → adjust
//   crop.adjust(form.photoFile, form.photoPreview)     // re-adjust later
//   {crop.dialog}
// Re-adjusting a cropped file starts from the photo originally picked (so
// zooming back out never loses the edges); an already-saved photo is
// adjusted from its URL.
export function useImageCrop({ aspect = 1, shape = 'rect', onCropped }) {
  const [pending, setPending] = useState(null) // { source, original }
  const originals = useRef(new WeakMap()) // cropped File → picked File

  function fromInput(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) setPending({ source: file, original: file })
  }

  function adjust(currentFile, fallbackUrl) {
    const original = (currentFile && originals.current.get(currentFile)) || currentFile
    if (original) setPending({ source: original, original })
    else if (fallbackUrl) setPending({ source: fallbackUrl, original: null })
  }

  const { source, original } = pending || {}
  const dialog = pending ? (
    <ImageCropDialog
      key={typeof source === 'string' ? source : `${source.name}-${source.lastModified}`}
      source={source}
      fileName={typeof source === 'string' ? 'image.jpg' : source.name}
      aspect={aspect}
      shape={shape}
      onCancel={() => setPending(null)}
      onDone={(file) => {
        if (original && file !== original) originals.current.set(file, original)
        setPending(null)
        onCropped(file)
      }}
    />
  ) : null

  return { fromInput, adjust, dialog }
}
