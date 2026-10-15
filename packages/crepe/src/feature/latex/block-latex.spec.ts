import '@testing-library/jest-dom/vitest'
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  rootCtx,
} from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { getMarkdown } from '@milkdown/kit/utils'
import { describe, expect, test } from 'vitest'

import { blockLatexSchema } from './block-latex'
import { mathInlineSchema } from './inline-latex'
import { mathBlockInputRule } from './input-rule'
import { remarkMathBlockPlugin, remarkMathPlugin } from './remark'

async function createEditor(markdown: string) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
    .use(commonmark)
    .use(remarkMathPlugin)
    .use(remarkMathBlockPlugin)
    .use(mathInlineSchema)
    .use(blockLatexSchema)
    .use(mathBlockInputRule)
  await editor.create()
  return editor
}

const blocks = (editor: Editor) =>
  editor.ctx
    .get(editorViewCtx)
    .state.doc.children.map(
      (node) => `${node.type.name}:${node.attrs.language}:${node.attrs.fence}`
    )

describe('blocks of math', () => {
  test('`$$` comes back as `$$`, and a ```latex fence as a fence', async () => {
    const markdown = '$$\nE = mc^2\n$$\n\n```latex\n\\LaTeX\n```\n'
    const editor = await createEditor(markdown)
    expect(blocks(editor)).toEqual([
      'code_block:LaTeX:$$',
      'code_block:latex:`',
    ])
    expect(editor.action(getMarkdown())).toBe(markdown)
  })

  test('`$$ ` typed at the start of a line makes a block written as `$$`', async () => {
    const editor = await createEditor('')
    const view = editor.ctx.get(editorViewCtx)
    for (const char of '$$ x') {
      const { from, to } = view.state.selection
      const insert = () => view.state.tr.insertText(char, from, to)
      const handled = view.someProp('handleTextInput', (handle) =>
        handle(view, from, to, char, insert)
      )
      if (!handled) view.dispatch(insert())
    }
    expect(blocks(editor)).toEqual(['code_block:LaTeX:$$'])
    expect(editor.action(getMarkdown())).toBe('$$\nx\n$$\n')
  })
})
