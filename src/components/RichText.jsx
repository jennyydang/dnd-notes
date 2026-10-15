import { Fragment, useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { toEditorContent } from '../lib/richNotes.js'
import './RichText.scss'

// Simple formatting for the notes on cards (NPCs, loot, monsters, places,
// quests, lore, party…): bold, italic, underline, bulleted and numbered
// lists. Stored as a small HTML subset; older plain-text notes still read
// and edit fine. RichText shows them without running any stored HTML —
// it's rebuilt from an allow-list of tags as React elements.

const extensions = (placeholder) => [
  StarterKit.configure({
    heading: false,
    code: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    link: false,
    strike: false,
  }),
  Placeholder.configure({ placeholder }),
]

export function RichTextEditor({ id, value, onChange, placeholder = '', ariaLabel, minHeight, disabled = false }) {
  const lastValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: extensions(placeholder),
    content: toEditorContent(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-text__content',
        ...(id ? { id } : {}),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Trailing empty paragraphs (from a last Enter) aren't worth saving.
      const html = ed.isEmpty ? '' : ed.getHTML().replace(/(<p><\/p>)+$/, '')
      lastValueRef.current = html
      onChangeRef.current(html)
    },
  })

  // Reload only when the value changes from outside (e.g. the form is
  // reset or filled in for editing), not on our own updates.
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
      underline: ed?.isActive('underline') ?? false,
      bulletList: ed?.isActive('bulletList') ?? false,
      orderedList: ed?.isActive('orderedList') ?? false,
    }),
  })

  // Buttons act without stealing focus, so the selection stays put.
  const keepFocus = (event) => event.preventDefault()
  const tool = (key, label, title, run) => (
    <button
      key={key}
      type="button"
      className={`rich-text__tool${active?.[key] ? ' rich-text__tool--active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={Boolean(active?.[key])}
      onMouseDown={keepFocus}
      onClick={() => editor && run(editor.chain().focus()).run()}
      disabled={!editor || disabled}
    >
      {label}
    </button>
  )

  return (
    <div className="rich-text rich-text--editor" style={minHeight ? { '--rich-text-min-height': minHeight } : undefined}>
      <div className="rich-text__toolbar" role="toolbar" aria-label="Formatting">
        {tool('bold', <strong>B</strong>, 'Bold', (c) => c.toggleBold())}
        {tool('italic', <em>I</em>, 'Italic', (c) => c.toggleItalic())}
        {tool('underline', <u>U</u>, 'Underline', (c) => c.toggleUnderline())}
        {tool('bulletList', '•', 'Bulleted list', (c) => c.toggleBulletList())}
        {tool('orderedList', '1.', 'Numbered list', (c) => c.toggleOrderedList())}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

const ALLOWED = { P: 'p', BR: 'br', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', UL: 'ul', OL: 'ol', LI: 'li' }
// Wrappers whose text is kept (pasted notes often have them); anything
// else — scripts, styles, embeds — is dropped with its contents.
const TRANSPARENT = new Set(['SPAN', 'DIV', 'A', 'FONT', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'S', 'CODE', 'PRE'])

function toReact(node, key) {
  if (node.nodeType === 3) return node.textContent
  if (node.nodeType !== 1) return null
  const tag = ALLOWED[node.tagName]
  if (!tag && !TRANSPARENT.has(node.tagName)) return null
  const children = [...node.childNodes].map((child, i) => toReact(child, i))
  if (!tag) return <Fragment key={key}>{children}</Fragment>
  if (tag === 'br') return <br key={key} />
  const Tag = tag
  return <Tag key={key}>{children}</Tag>
}

// Shows formatted notes. Plain text keeps its line breaks; formatted
// notes become paragraphs, lists and emphasis — nothing else.
export function RichText({ value, className = '' }) {
  const content = useMemo(() => {
    if (!value) return null
    if (!value.trimStart().startsWith('<')) return null
    const doc = new DOMParser().parseFromString(value, 'text/html')
    return [...doc.body.childNodes].map((node, i) => toReact(node, i))
  }, [value])
  if (!value) return null
  if (!content) return <p className={`rich-text rich-text--plain ${className}`}>{value}</p>
  return <div className={`rich-text rich-text--view ${className}`}>{content}</div>
}
