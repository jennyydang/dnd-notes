import { useId, useState } from 'react'
import Icon from './Icon.jsx'
import './TypeCombobox.scss'

// A text field with a dropdown of suggestions that — unlike a browser
// <datalist> — always offers every option once one is picked (a datalist
// only lists matches for what's typed, so after choosing "Beast" it only
// ever offered "Beast"). Typing narrows the list; free text is fine.
function TypeCombobox({ id, value, onChange, options, placeholder }) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = value.trim().toLowerCase()
  const exact = options.some((o) => o.toLowerCase() === typed)
  const shown = !typed || exact ? options : options.filter((o) => o.toLowerCase().includes(typed))

  function pick(option) {
    onChange(option)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className={`type-combo${open ? ' is-open' : ''}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((i) => Math.min(shown.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
            e.preventDefault()
            pick(shown[active])
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      <button
        type="button"
        className="type-combo__toggle"
        tabIndex={-1}
        aria-label="Show types"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((o) => !o)
          document.getElementById(id)?.focus()
        }}
      >
        <Icon name="next" />
      </button>
      {open && shown.length > 0 && (
        <ul className="type-combo__list" id={listId} role="listbox">
          {shown.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={option.toLowerCase() === typed}
              className={`type-combo__option${i === active ? ' is-active' : ''}${option.toLowerCase() === typed ? ' is-chosen' : ''}`}
              // mousedown, so the field doesn't blur (and close) first
              onMouseDown={(e) => {
                e.preventDefault()
                pick(option)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {option}
              {option.toLowerCase() === typed && <Icon name="check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TypeCombobox
