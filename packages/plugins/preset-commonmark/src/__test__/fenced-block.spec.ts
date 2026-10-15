import '@testing-library/jest-dom/vitest'
import { defaultValueCtx, Editor, editorViewCtx, rootCtx } from '@milkdown/core'
import { getMarkdown } from '@milkdown/utils'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { $fencedBlock, commonmark } from '..'

const molecule = $fencedBlock('molecule', (language) =>
  ['smiles', 'xyz'].includes(language.toLowerCase())
)

async function createEditor(markdown: string, ...plugins: unknown[]) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = Editor.make()
  editor.config((ctx) => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, markdown)
  })
  editor.use(commonmark)
  for (const plugin of plugins) editor.use(plugin as never)
  await editor.create()
  return editor
}

const view = (editor: Editor) => editor.ctx.get(editorViewCtx)

const blocks = (editor: Editor) =>
  view(editor).state.doc.children.map(
    (node) => `${node.type.name}:${node.attrs.language ?? ''}`
  )

describe('$fencedBlock', () => {
  it('takes the fences of its languages, and leaves the rest to the code block', async () => {
    const editor = await createEditor(
      '```smiles\nCCO\n```\n\n```python\nprint(1)\n```\n\n```XYZ\n1\n```\n',
      molecule
    )
    expect(blocks(editor)).toEqual([
      'molecule:smiles',
      'code_block:python',
      'molecule:XYZ',
    ])
    expect(view(editor).state.doc.firstChild!.textContent).toBe('CCO')
  })

  it('writes the fence back as it was written', async () => {
    const markdown =
      '~~~smiles title="ethanol"\nCCO\n~~~\n\n```xyz\n1\nwater\nO 0 0 0\n```\n'
    const editor = await createEditor(markdown, molecule)
    expect(editor.action(getMarkdown())).toBe(markdown)
  })

  it('without one, every fence is a code block', async () => {
    const editor = await createEditor('```smiles\nCCO\n```\n')
    expect(blocks(editor)).toEqual(['code_block:smiles'])
  })

  it('a code block given its language becomes it, and back', async () => {
    const editor = await createEditor('```python\nCCO\n```\n', molecule)
    const setLanguage = (language: string) => {
      const { state } = view(editor)
      view(editor).dispatch(state.tr.setNodeAttribute(0, 'language', language))
    }
    setLanguage('smiles')
    expect(blocks(editor)).toEqual(['molecule:smiles'])
    expect(view(editor).state.doc.firstChild!.textContent).toBe('CCO')

    setLanguage('js')
    expect(blocks(editor)).toEqual(['code_block:js'])
  })

  it('a fence typed with its language becomes it', async () => {
    const editor = await createEditor('', molecule)
    const user = userEvent.setup()
    await user.type(view(editor).dom, '```smiles ')
    expect(blocks(editor)).toEqual(['molecule:smiles'])
  })

  it('a language with a dash can be typed on a fence', async () => {
    const editor = await createEditor('')
    const user = userEvent.setup()
    await user.type(view(editor).dom, '```sdf-3d ')
    expect(blocks(editor)).toEqual(['code_block:sdf-3d'])
  })
})
