import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { notifyTableChanged, useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { toEditorContent } from '../lib/richNotes.js'
import './RichNotesEditor.scss'

// "@" tags a person (an NPC), "#" tags a place (a Lore entry categorised
// as a location — there's no dedicated places table).
const KINDS = {
  person: { char: '@', table: 'npcs', noun: 'person' },
  place: { char: '#', table: 'lore_entries', noun: 'place' },
}

const PLACE_CATEGORY = 'Location'
const isPlaceCategory = (category) => /location|place/i.test(category || '')

const MAX_SUGGESTIONS = 6
// Names can have spaces ("Elandra Voss"), so the suggestion stays open
// across spaces — but past a few words the player is clearly just
// writing a sentence, so stop offering to turn it into a name.
const MAX_NAME_WORDS = 4

const npcFromRow = (r) => ({ id: r.id, label: r.name })
const loreFromRow = (r) => ({ id: r.id, label: r.title, category: r.category })

// StarterKit minus the block types a session recap doesn't need —
// headings in particular would fight with "#" as the place trigger.
function baseExtensions(mentionOptions = {}) {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      link: false,
    }),
    Mention.configure({
      renderText: ({ node }) => node.attrs.label ?? '',
      renderHTML: ({ options, node }) => {
        const kind = node.attrs.mentionSuggestionChar === KINDS.place.char ? 'place' : 'person'
        return [
          'span',
          mergeAttributes(options.HTMLAttributes, { class: `mention mention--${kind}` }),
          node.attrs.label ?? '',
        ]
      },
      ...mentionOptions,
    }),
  ]
}

function filterItems(list, query) {
  const trimmed = query.trim()
  if (trimmed.split(/\s+/).length > MAX_NAME_WORDS) return []
  const needle = trimmed.toLowerCase()
  const matches = list
    .filter((item) => item.label.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS)
  const exact = list.some((item) => item.label.trim().toLowerCase() === needle)
  return needle && !exact ? [...matches, { create: true, label: trimmed }] : matches
}

// Rich-text recap editor with inline people/place tags. Tagging someone
// who doesn't exist yet creates their NPC card (or Lore location) on the
// spot, so the player can fill in the details later from that tab.
// `value` / `onChange` are HTML strings; an empty editor reports ''.
export function RichNotesEditor({
  campaignId,
  value,
  onChange,
  metAt = '',
  placeholder,
  disabled = false,
  labelId,
  className = '',
}) {
  const filters = { campaign_id: campaignId }
  const { items: people, addItem: addNpc } = useSupabaseTable('npcs', {
    fromRow: npcFromRow,
    orderBy: 'name',
    filters,
  })
  const { items: lore, addItem: addLore } = useSupabaseTable('lore_entries', {
    fromRow: loreFromRow,
    orderBy: 'title',
    filters,
  })
  const places = lore.filter((entry) => isPlaceCategory(entry.category))

  // The editor and its suggestion plugins are built once, so everything
  // they read at call time goes through refs to always see current data.
  const listsRef = useRef({ person: people, place: places })
  listsRef.current = { person: people, place: places }
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const metAtRef = useRef(metAt)
  metAtRef.current = metAt
  const createRef = useRef(null)
  createRef.current = {
    person: async (name) => {
      const npc = await addNpc({ name, met_at: metAtRef.current.trim() })
      notifyTableChanged('npcs')
      return npc
    },
    place: async (title) => {
      const entry = await addLore({ title, category: PLACE_CATEGORY, notes: '' })
      notifyTableChanged('lore_entries')
      return entry
    },
  }

  const [menu, setMenu] = useState(null)
  const menuRef = useRef(null)
  menuRef.current = menu
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [createError, setCreateError] = useState(null)

  async function choose(current, index) {
    const item = current.items[index]
    if (!item || creatingRef.current) return
    if (!item.create) {
      current.command({ id: item.id, label: item.label })
      return
    }
    creatingRef.current = true
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createRef.current[current.kind](item.label)
      current.command({ id: created.id, label: item.label })
    } catch (err) {
      setCreateError(`Couldn't add ${item.label}: ${err.message}`)
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }
  const chooseRef = useRef(choose)
  chooseRef.current = choose

  function suggestionFor(kind) {
    return {
      char: KINDS[kind].char,
      pluginKey: new PluginKey(`mention-${kind}`),
      allowSpaces: true,
      items: ({ query }) => filterItems(listsRef.current[kind], query),
      render: () => {
        const show = (props) =>
          setMenu({
            kind,
            items: props.items,
            command: props.command,
            rect: props.clientRect?.() ?? null,
            index: 0,
          })
        return {
          onStart: show,
          onUpdate: show,
          onExit: () => setMenu(null),
          onKeyDown: ({ event }) => {
            // The suggestion plugin dismisses itself on Escape; just keep
            // the keypress from also reaching Modal's close-on-Escape.
            if (event.key === 'Escape') {
              event.stopPropagation()
              return true
            }
            const current = menuRef.current
            if (!current || current.items.length === 0) return false
            const count = current.items.length
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              const step = event.key === 'ArrowDown' ? 1 : -1
              setMenu({ ...current, index: (current.index + step + count) % count })
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              chooseRef.current(current, current.index)
              return true
            }
            return false
          },
        }
      },
    }
  }

  const lastValueRef = useRef(value)
  const editor = useEditor({
    extensions: [
      ...baseExtensions({ suggestions: [suggestionFor('person'), suggestionFor('place')] }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorContent(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-notes__content',
        ...(labelId ? { 'aria-labelledby': labelId } : {}),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML()
      lastValueRef.current = html
      onChangeRef.current(html)
    },
  })

  // Only reload the document when the value changes from outside (e.g.
  // Quick View seeding the form after mount) — not on our own onUpdate
  // echoes, which would reset the cursor on every keystroke.
  useEffect(() => {
    if (!editor || value === lastValueRef.current) return
    lastValueRef.current = value
    editor.commands.setContent(toEditorContent(value), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      bulletList: ed?.isActive('bulletList') ?? false,
    }),
  })

  // Toolbar shortcut for players who don't know the @ / # triggers: types
  // the trigger character for them, adding a space first if needed since
  // a trigger glued to the previous word doesn't open the suggestions.
  function insertTrigger(kind) {
    if (!editor) return
    const { $from } = editor.state.selection
    const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset)
    const prefix = before && !/\s/.test(before) ? ' ' : ''
    editor.chain().focus().insertContent(`${prefix}${KINDS[kind].char}`).run()
  }

  // Toolbar buttons act on mousedown-prevented clicks so the editor keeps
  // its selection instead of losing focus to the button.
  const keepFocus = (event) => event.preventDefault()

  const toolbarButton = (label, title, isActive, onClick) => (
    <button
      type="button"
      className={`rich-notes__tool${isActive ? ' rich-notes__tool--active' : ''}`}
      title={title}
      aria-pressed={isActive}
      onMouseDown={keepFocus}
      onClick={onClick}
      disabled={disabled || !editor}
    >
      {label}
    </button>
  )

  return (
    <div className={`rich-notes${disabled ? ' rich-notes--disabled' : ''} ${className}`}>
      <div className="rich-notes__toolbar" role="toolbar" aria-label="Formatting">
        {toolbarButton(<strong>B</strong>, 'Bold', active?.bold, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {toolbarButton(<em>I</em>, 'Italic', active?.italic, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {toolbarButton('• List', 'Bulleted list', active?.bulletList, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        <span className="rich-notes__toolbar-divider" aria-hidden="true" />
        {toolbarButton('👤 Person', 'Tag a person (or type @)', false, () => insertTrigger('person'))}
        {toolbarButton('📍 Place', 'Tag a place (or type #)', false, () => insertTrigger('place'))}
      </div>

      <EditorContent editor={editor} />

      <p className="rich-notes__hint">
        Type <kbd>@</kbd> to tag a person or <kbd>#</kbd> to tag a place. New names are added to
        the NPCs / Lore tabs automatically.
      </p>
      {createError && <p className="empty-state empty-state--error">{createError}</p>}

      {menu && menu.items.length > 0 && menu.rect &&
        createPortal(
          <ul
            className="rich-notes__menu panel"
            role="listbox"
            style={{ top: menu.rect.bottom + 4, left: menu.rect.left }}
          >
            {menu.items.map((item, index) => (
              <li key={item.create ? '__create__' : item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === menu.index}
                  className={`rich-notes__option${index === menu.index ? ' rich-notes__option--active' : ''}${item.create ? ' rich-notes__option--create' : ''}`}
                  onMouseDown={keepFocus}
                  onMouseEnter={() => setMenu({ ...menu, index })}
                  onClick={() => choose(menu, index)}
                  disabled={creating}
                >
                  {item.create ? (
                    <>
                      {creating ? 'Adding…' : `+ New ${KINDS[menu.kind].noun}:`}{' '}
                      <strong>{item.label}</strong>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{menu.kind === 'place' ? '📍' : '👤'}</span>{' '}
                      {item.label}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}

// Read-only rendering of a saved recap, with the same chip styling as
// the editor. Going through the editor's schema (rather than injecting
// the stored HTML directly) drops anything the editor itself couldn't
// have produced.
export function RichNotesView({ value, className = '' }) {
  const editor = useEditor(
    {
      extensions: baseExtensions(),
      content: toEditorContent(value),
      editable: false,
      editorProps: { attributes: { class: 'rich-notes__content rich-notes__content--readonly' } },
    },
    [value],
  )
  return <EditorContent editor={editor} className={`rich-notes rich-notes--view ${className}`} />
}
