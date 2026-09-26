// Native confirm keeps destructive actions deliberate without a custom
// dialog per screen; it's keyboard- and screen-reader-accessible.
export function confirmDelete(what) {
  return window.confirm(`Delete ${what}? This can't be undone.`)
}
