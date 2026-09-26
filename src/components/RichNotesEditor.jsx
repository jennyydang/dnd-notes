import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { mergeAttributes } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'
import { toEditorContent } from '../lib/richNotes.js'
import { TAG_GROUPS, groupForChar, matchKind, tagSlug, tagText } from '../lib/tags.js'
import './RichNotesEditor.scss'

const GROUP_ORDER = ['person', 'place', 'lore', 'loot', 'event']

const MAX_SUGGESTIONS = 6
// Names can have spaces ("Elandra Voss"), so the suggestion stays open
// across spaces — but past a few words the player is clearly just
// writing a sentence, so stop offering to turn it into a name.
const MAX_NAME_WORDS = 4
// Events are short sentences rather than names, so they get more room.
const MAX_EVENT_WORDS = 25

const npcFromRow = (r) => ({ id: r.id, label: r.name, kind: null })
const placeFromRow = (r) => ({ id: r.id, label: r.name, kind: matchKind('place', r.kind) })
const loreFromRow = (r) => ({ id: r.id, label: r.title, kind: matchKind('lore', r.category) })
const lootFromRow = (r) => ({ id: r.id, label: r.item, kind: matchKind('loot', r.kind) })

// Mention plus a `kind` attribute, so a chip remembers which tag it was
// made with (e.g. "#dungeon") rather than just which trigger character.
const TaggedMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-kind'),
        renderHTML: (attributes) => (attributes.kind ? { 'data-kind': attributes.kind } : {}),
      },
    }
  },
})

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
    TaggedMention.configure({
      renderText: ({ node }) => node.attrs.label ?? '',
      renderHTML: ({ options, node }) => {
        const group = groupForChar(node.attrs.mentionSuggestionChar)
        const kind = matchKind(group, node.attrs.kind)
        return [
          'span',
          mergeAttributes(options.HTMLAttributes, {
            class: `mention mention--${group}`,
            title: kind ? tagText(group, kind) : TAG_GROUPS[group].noun,
          }),
          node.attrs.label ?? '',
        ]
      },
      ...mentionOptions,
    }),
  ]
}

// "city Waterdeep" → { kind: 'City', name: 'Waterdeep' }, so typing
// "#city Waterdeep" picks the tag up front. Without a leading tag word
// the whole query is the name.
function parseQuery(group, query) {
  const text = query.trimStart()
  const lower = text.toLowerCase()
  for (const kind of TAG_GROUPS[group].kinds) {
    for (const word of new Set([tagSlug(kind), kind.toLowerCase()])) {
      if (lower === word) return { kind, name: '' }
      if (lower.startsWith(`${word} `)) return { kind, name: text.slice(word.length + 1).trim() }
    }
  }
  return { kind: null, name: text.trim() }
}

// "!event The dragon attacks" → a single "add to timeline" row. Requires
// the "event" keyword so a stray "!" in normal writing never offers it.
function eventItems(query) {
  const match = /^event\s+(.+)$/i.exec(query.trimStart())
  const text = match?.[1].trim()
  if (!text || text.split(/\s+/).length > MAX_EVENT_WORDS) return []
  return [{ create: true, kind: null, label: text }]
}

function filterItems(group, list, query) {
  if (group === 'event') return eventItems(query)
  const { kind, name } = parseQuery(group, query)
  if (name.split(/\s+/).length > MAX_NAME_WORDS) return []
  const needle = name.toLowerCase()
  const pool = kind ? list.filter((item) => item.kind === kind) : list
  const matches = pool
    .filter((item) => item.label.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS)
  const exact = pool.some((item) => item.label.trim().toLowerCase() === needle)
  if (!name || exact) return matches

  // One "create" row per tag the new entry could get — or just the one
  // already typed, e.g. "#city ..." only offers a new city.
  const kinds = TAG_GROUPS[group].kinds
  const createKinds = kind ? [kind] : kinds.length ? kinds : [null]
  return [...matches, ...createKinds.map((k) => ({ create: true, kind: k, label: name }))]
}

// Rich-text recap editor with inline tags: @person, #place, ~lore and
// $loot. Tagging something that doesn't exist yet creates it on the spot
// (NPC card, Maps-tab place, Lore entry or Loot item) with the chosen tag,
// so the player can fill in the details later from that tab.
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
  const tables = {
    person: useSupabaseTable('npcs', { fromRow: npcFromRow, orderBy: 'name', filters }),
    place: useSupabaseTable('places', { fromRow: placeFromRow, orderBy: 'name', filters }),
    lore: useSupabaseTable('lore_entries', { fromRow: loreFromRow, orderBy: 'title', filters }),
    loot: useSupabaseTable('loot', { fromRow: lootFromRow, orderBy: 'item', filters }),
  }

  // The editor and its suggestion plugins are built once, so everything
  // they read at call time goes through refs to always see current data.
  const listsRef = useRef(null)
  listsRef.current = Object.fromEntries(Object.entries(tables).map(([g, t]) => [g, t.items]))
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const metAtRef = useRef(metAt)
  metAtRef.current = metAt
  const createRef = useRef(null)
  createRef.current = async (group, name, kind) => {
    const origin = metAtRef.current.trim()
    const payload = {
      person: { name, met_at: origin },
      place: { name, kind, notes: '' },
      lore: { title: name, category: kind, notes: '' },
      loot: { item: name, kind, found_at: origin, holder: '', notes: '' },
    }[group]
    // addItem broadcasts the change, so the target tab updates too.
    return tables[group].addItem(payload)
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
      current.command({ id: item.id, label: item.label, kind: item.kind })
      return
    }
    // Events have no row of their own — the chip in the recap is the event.
    if (current.group === 'event') {
      current.command({ id: crypto.randomUUID(), label: item.label, kind: null })
      return
    }
    creatingRef.current = true
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createRef.current(current.group, item.label, item.kind)
      current.command({ id: created.id, label: item.label, kind: item.kind })
    } catch (err) {
      setCreateError(`Couldn't add ${item.label}: ${err.message}`)
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }
  const chooseRef = useRef(choose)
  chooseRef.current = choose

  function suggestionFor(group) {
    return {
      char: TAG_GROUPS[group].char,
      pluginKey: new PluginKey(`mention-${group}`),
      allowSpaces: true,
      items: ({ query }) => filterItems(group, listsRef.current[group], query),
      render: () => {
        const show = (props) =>
          setMenu({
            group,
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
      ...baseExtensions({ suggestions: GROUP_ORDER.map(suggestionFor) }),
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

  // Toolbar shortcut for players who don't know the trigger characters:
  // types it for them, adding a space first if needed since a trigger
  // glued to the previous word doesn't open the suggestions.
  function insertTrigger(group) {
    if (!editor) return
    const { $from } = editor.state.selection
    const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset)
    const prefix = before && !/\s/.test(before) ? ' ' : ''
    const { char, keyword } = TAG_GROUPS[group]
    editor
      .chain()
      .focus()
      .insertContent(`${prefix}${char}${keyword ? `${keyword} ` : ''}`)
      .run()
  }

  // Toolbar buttons act on mousedown-prevented clicks so the editor keeps
  // its selection instead of losing focus to the button.
  const keepFocus = (event) => event.preventDefault()

  const toolbarButton = (key, label, title, isActive, onClick) => (
    <button
      key={key}
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

  const capitalize = (text) => text[0].toUpperCase() + text.slice(1)

  return (
    <div className={`rich-notes${disabled ? ' rich-notes--disabled' : ''} ${className}`}>
      <div className="rich-notes__toolbar" role="toolbar" aria-label="Formatting">
        {toolbarButton('bold', <strong>B</strong>, 'Bold', active?.bold, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {toolbarButton('italic', <em>I</em>, 'Italic', active?.italic, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {toolbarButton('list', '• List', 'Bulleted list', active?.bulletList, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        <span className="rich-notes__toolbar-divider" aria-hidden="true" />
        {GROUP_ORDER.map((group) => {
          const { icon, noun, char, keyword } = TAG_GROUPS[group]
          const article = { person: 'a ', place: 'a ', event: 'an ' }[noun] ?? ''
          return toolbarButton(
            group,
            `${icon} ${capitalize(noun)}`,
            `Tag ${article}${noun} (or type ${char}${keyword ?? ''})`,
            false,
            () => insertTrigger(group),
          )
        })}
      </div>

      <EditorContent editor={editor} />

      <p className="rich-notes__hint">
        Tag with <kbd>@</kbd> person, <kbd>#</kbd> place, <kbd>~</kbd> lore, <kbd>$</kbd> loot —
        e.g. <kbd>#city Waterdeep</kbd>. New ones are added to their tab automatically.{' '}
        <kbd>!event</kbd> adds a moment to the Timeline.
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
              <li key={item.create ? `__create__${item.kind}` : item.id}>
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
                      {creating
                        ? 'Adding…'
                        : menu.group === 'event'
                          ? '⭐ Add to timeline:'
                          : `+ New ${item.kind ? tagText(menu.group, item.kind) : TAG_GROUPS[menu.group].noun}:`}{' '}
                      <strong>{item.label}</strong>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{TAG_GROUPS[menu.group].icon}</span> {item.label}
                      {item.kind && (
                        <span className="rich-notes__option-tag">{tagText(menu.group, item.kind)}</span>
                      )}
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
