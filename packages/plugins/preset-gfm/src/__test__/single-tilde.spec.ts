import '@testing-library/jest-dom/vitest'
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { TextSelection } from '@milkdown/prose/state'
import { describe, expect, it } from 'vitest'

import { gfm, remarkGFMPlugin } from '..'

async function createEditor(markdown: string, singleTilde?: boolean) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = Editor.make()
  editor.config((ctx) => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, markdown)
    if (singleTilde !== undefined)
      ctx.set(remarkGFMPlugin.options.key, { singleTilde })
  })
  editor.use(commonmark)
  editor.use(gfm)
  await editor.create()
  return editor
}

const struck = (editor: Editor) => {
  const texts: string[] = []
  editor.ctx.get(editorViewCtx).state.doc.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === 'strike_through'))
      texts.push(node.text ?? '')
  })
  return texts
}

const markdown = (editor: Editor) => {
  const view = editor.ctx.get(editorViewCtx)
  return editor.ctx.get(serializerCtx)(view.state.doc)
}

/// Types `text` one character at a time at the end of the first paragraph.
function type(editor: Editor, text: string) {
  const view = editor.ctx.get(editorViewCtx)
  for (const char of text) {
    const end = view.state.doc.firstChild!.nodeSize - 1
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, end))
    )
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (handle) =>
      handle(view, from, to, char, () => view.state.tr.insertText(char))
    )
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to))
  }
}

describe('singleTilde: false', () => {
  it('reads one tilde as text and writes it back as it was', async () => {
    const editor = await createEditor('H~2~O at ~300 K and ~~gone~~\n', false)
    expect(struck(editor)).toEqual(['gone'])
    expect(markdown(editor)).toBe('H~2~O at ~300 K and ~~gone~~\n')
  })

  it('strikes through as two tildes are typed, not one', async () => {
    const editor = await createEditor('start\n', false)
    type(editor, ' H~2~O')
    expect(struck(editor)).toEqual([])
    type(editor, ' ~~gone~~')
    expect(struck(editor)).toEqual(['gone'])
    expect(markdown(editor)).toBe('start H~2~O ~~gone~~\n')
  })
})

describe('by default', () => {
  it('one tilde strikes through, as remark-gfm reads it', async () => {
    const editor = await createEditor('H~2~O\n')
    expect(struck(editor)).toEqual(['2'])
    type(editor, ' ~x~')
    expect(struck(editor)).toEqual(['2', 'x'])
  })
})
