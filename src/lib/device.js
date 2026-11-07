// iPhones and iPads (every browser there is Safari underneath, Chrome
// included) and Safari on a Mac. Safari can *record* WebM, but playing
// those recordings back can crash the page, so on these devices the app
// records and stores M4A (AAC) instead — Apple's own format, which every
// other browser plays too.
export function isAppleWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const macSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium|Edg\/|OPR\/|Firefox\//.test(ua)
  return ios || macSafari
}
