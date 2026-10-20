import { Extension, wrappingInputRule } from '@tiptap/react'

// Typing a bullet character and a space at the start of a line starts a
// bulleted list — "•", "–" or "—" (what phones and iPads often turn a
// typed dash into), alongside the built-in "- ", "* " and "1. ".
export const ListShortcuts = Extension.create({
  name: 'listShortcuts',
  addInputRules() {
    const { bulletList } = this.editor.schema.nodes
    return bulletList ? [wrappingInputRule({ find: /^\s*([•–—])\s$/, type: bulletList })] : []
  },
})
