// App-styled dropdown lists for every <select>. A native select's open
// list is drawn by the browser / OS (white, system font), and CSS can't
// reach it. On a computer with a mouse or trackpad this opens our own
// list instead — dark panel, gold highlight, the app's fonts — and
// writes the choice back to the real <select> (firing `change`, so
// React's onChange runs as usual). Phones and tablets keep their native
// touch pickers, which suit fingers better.
const FINE_POINTER = '(hover: hover) and (pointer: fine)'
const OPEN_KEYS = new Set([' ', 'Enter', 'ArrowDown', 'ArrowUp'])
const GAP = 4 // px between the select and its list

const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set

function enhanceable(select) {
  return select instanceof HTMLSelectElement && !select.disabled && !select.multiple && select.size <= 1
}

export function installSelectMenus() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const fine = window.matchMedia(FINE_POINTER)
  let menu = null // { select, list, items, active, typed, typedAt }

  function close({ refocus = true } = {}) {
    if (!menu) return
    const { select, list } = menu
    menu = null
    list.remove()
    select.removeAttribute('aria-expanded')
    if (refocus) select.focus({ preventScroll: true })
  }

  function choose(index) {
    if (!menu) return
    const { select, items } = menu
    const option = items[index]?.option
    close()
    if (!option || option.disabled || option.value === select.value) return
    setSelectValue.call(select, option.value)
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function setActive(index, scroll = true) {
    if (!menu) return
    const { items } = menu
    if (!items.length) return
    const i = Math.max(0, Math.min(items.length - 1, index))
    menu.items[menu.active]?.el.classList.remove('select-menu__option--active')
    menu.active = i
    const el = items[i].el
    el.classList.add('select-menu__option--active')
    menu.list.setAttribute('aria-activedescendant', el.id)
    if (scroll) el.scrollIntoView({ block: 'nearest' })
  }

  // Next enabled option from `from` in `step` direction.
  function step(from, dir) {
    const { items } = menu
    for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
      if (!items[i].option.disabled) return i
    }
    return from
  }

  function place() {
    if (!menu) return
    const { select, list } = menu
    const box = select.getBoundingClientRect()
    list.style.minWidth = `${box.width}px`
    list.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - list.offsetWidth - 8))}px`
    const below = window.innerHeight - box.bottom - GAP - 8
    const above = box.top - GAP - 8
    const height = list.scrollHeight
    // Open downwards unless it only fits (or fits better) above.
    if (height > below && above > below) {
      list.style.maxHeight = `${Math.min(above, 320)}px`
      list.style.top = `${box.top - GAP - Math.min(height, above, 320)}px`
      list.classList.add('select-menu--up')
    } else {
      list.style.maxHeight = `${Math.min(below, 320)}px`
      list.style.top = `${box.bottom + GAP}px`
    }
  }

  function open(select) {
    close({ refocus: false })
    const list = document.createElement('div')
    list.className = 'select-menu'
    list.setAttribute('role', 'listbox')
    list.id = `select-menu-${Math.random().toString(36).slice(2)}`
    const items = []
    let group = null
    for (const option of select.options) {
      // Show <optgroup> labels as small headings.
      const parent = option.parentElement
      if (parent instanceof HTMLOptGroupElement && parent !== group) {
        group = parent
        const heading = document.createElement('div')
        heading.className = 'select-menu__group'
        heading.textContent = parent.label
        list.appendChild(heading)
      }
      if (option.hidden) continue
      const el = document.createElement('div')
      el.className = 'select-menu__option'
      el.id = `${list.id}-${items.length}`
      el.setAttribute('role', 'option')
      el.textContent = option.textContent
      if (option.disabled) {
        el.classList.add('select-menu__option--disabled')
        el.setAttribute('aria-disabled', 'true')
      }
      if (option.selected) {
        el.classList.add('select-menu__option--selected')
        el.setAttribute('aria-selected', 'true')
      }
      const index = items.length
      el.addEventListener('mousemove', () => {
        if (menu?.active !== index && !option.disabled) setActive(index, false)
      })
      el.addEventListener('click', () => {
        if (!option.disabled) choose(index)
      })
      items.push({ el, option })
      list.appendChild(el)
    }
    // Keep focus on the select while clicking in the list.
    list.addEventListener('mousedown', (e) => e.preventDefault())
    // Inherit the select's font size (a compact filter vs. a form field).
    list.style.fontSize = getComputedStyle(select).fontSize
    document.body.appendChild(list)
    select.setAttribute('aria-expanded', 'true')
    select.setAttribute('aria-controls', list.id)
    menu = { select, list, items, active: -1, typed: '', typedAt: 0 }
    place()
    setActive(Math.max(0, items.findIndex((it) => it.option.selected)))
  }

  function onMouseDown(event) {
    const target = event.target
    if (menu && !menu.list.contains(target) && target !== menu.select) close({ refocus: false })
    if (!fine.matches || event.button !== 0 || !enhanceable(target)) return
    event.preventDefault() // no native list
    if (menu?.select === target) {
      close()
      return
    }
    target.focus({ preventScroll: true })
    open(target)
  }

  function onKeyDown(event) {
    const target = event.target
    if (!menu) {
      if (!fine.matches || !enhanceable(target) || event.metaKey || event.ctrlKey) return
      if (!OPEN_KEYS.has(event.key)) return
      event.preventDefault()
      open(target)
      return
    }
    if (target !== menu.select) return
    const { active, items } = menu
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive(step(active, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(step(active, -1))
        break
      case 'Home':
        event.preventDefault()
        setActive(step(-1, 1))
        break
      case 'End':
        event.preventDefault()
        setActive(step(items.length, -1))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(active)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation() // don't also close the dialog it's in
        close()
        break
      case 'Tab':
        close({ refocus: false })
        break
      default:
        // Type to jump to an option starting with those letters.
        if (event.key.length === 1 && !event.altKey) {
          const now = Date.now()
          menu.typed = (now - menu.typedAt < 700 ? menu.typed : '') + event.key.toLowerCase()
          menu.typedAt = now
          const hit = items.findIndex((it) => !it.option.disabled && it.option.textContent.trim().toLowerCase().startsWith(menu.typed))
          if (hit >= 0) setActive(hit)
        }
    }
  }

  function onScroll(event) {
    if (menu && !menu.list.contains(event.target)) close({ refocus: false })
  }
  const onResize = () => close({ refocus: false })
  const onBlur = () => close({ refocus: false })

  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
  window.addEventListener('blur', onBlur)
  return () => {
    close({ refocus: false })
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('blur', onBlur)
  }
}
