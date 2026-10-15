import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { getMarkdown } from '@milkdown/utils'
import { describe, expect, it } from 'vitest'

import { gfm } from '..'

async function createEditor(markdown: string) {
  const editor = Editor.make()
  editor.config((ctx) => ctx.set(defaultValueCtx, markdown))
  editor.use(commonmark).use(gfm)
  await editor.create()
  return editor
}

/// Types `text` right after the first `after` in the document's text.
async function typeAfter(markdown: string, after: string, text: string) {
  const editor = await createEditor(markdown)
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    let at = -1
    view.state.doc.descendants((node, pos) => {
      if (at >= 0 || !node.isText) return
      const index = node.text!.indexOf(after)
      if (index >= 0) at = pos + index + after.length
    })
    if (at < 0) throw new Error(`no ${after} in the document`)
    view.dispatch(view.state.tr.insertText(text, at))
  })
  return editor.action(getMarkdown())
}

describe('Markdown comes back as the author wrote it', () => {
  const cases = [
    'line one  \nline two\n',
    'line one\\\nline two\n',
    'see https://example.com now\n',
    '<https://example.com>\n',
    'Setext\n======\n',
    'Setext two\n----------\n',
    '| a | b |\n| :--- | ---: |\n| 1 | 2 |\n',
    '| 方法 | 能量 |\n| --- | --- |\n| HF | −10.40 |\n',
    '| a  | b  |\n| -- | -- |\n| cc | dd |\n',
    '| 方法 | 能量   |\n| ---- | ------ |\n| HF   | −10.40 |\n',
    '- a\n- b\n',
    '+ a\n+ b\n',
    '- a\n  - b\n',
    '- [ ] a\n- [x] b\n',
    '1) a\n2) b\n',
    '1. a\n1. b\n',
    '> q\n>\n> - l\n',
    '- a\n\n* b\n',
    '```python title="a.py"\nx = 1\n```\n',
    '~~~\nx\n~~~\n',
    '    indented\n',
    '---\n',
    '___\n',
    '- - -\n',
    '5 * 3 * 2\n',
    'a_b_c snake_case k_B E_HF\n',
    '[Cu(NH3)4]2+ and C#1 [bracket]\n',
    '转义：\\*不是强调\\*，还有 \\_下划线\\_。\n',
    '\\# not a heading\n',
    '1\\. not a list\n',
    'a \\<b> c\n',
  ]

  cases.forEach((markdown) => {
    it(`round-trips ${JSON.stringify(markdown)}`, async () => {
      const editor = await createEditor(markdown)
      expect(editor.action(getMarkdown())).toBe(markdown)
    })
  })
})

describe('an edit changes only what was edited', () => {
  it('keeps a list bullet', async () => {
    expect(await typeAfter('- a\n- b\n', 'b', 'c')).toBe('- a\n- bc\n')
  })

  it('keeps the delimiter of an ordered list', async () => {
    expect(await typeAfter('1) a\n2) b\n', 'a', 'x')).toBe('1) ax\n2) b\n')
  })

  it('keeps two-space hard breaks', async () => {
    expect(await typeAfter('one  \ntwo\n', 'two', '!')).toBe('one  \ntwo!\n')
  })

  it('does not escape what cannot start anything', async () => {
    expect(await typeAfter('k_B T = 2 * 3\n', '3', '.')).toBe(
      'k_B T = 2 * 3.\n'
    )
  })

  it('keeps the escapes a literal needs', async () => {
    expect(await typeAfter('\\*不是强调\\* 和 5 * 3\n', '3', '。')).toBe(
      '\\*不是强调\\* 和 5 * 3。\n'
    )
  })

  it('keeps an unpadded table unpadded', async () => {
    expect(
      await typeAfter('| a | b |\n| --- | :---: |\n| 1 | 2 |\n', '1', '0')
    ).toBe('| a | b |\n| --- | :---: |\n| 10 | 2 |\n')
  })

  it('pads a padded table again', async () => {
    expect(
      await typeAfter('| a  | b  |\n| -- | -- |\n| cc | dd |\n', 'cc', 'c')
    ).toBe('| a   | b  |\n| --- | -- |\n| ccc | dd |\n')
  })

  it('pads a CJK table by display width', async () => {
    expect(
      await typeAfter(
        '| 方法 | 能量   |\n| ---- | ------ |\n| HF   | −10.40 |\n',
        'HF',
        '方法'
      )
    ).toBe('| 方法   | 能量   |\n| ------ | ------ |\n| HF方法 | −10.40 |\n')
  })

  it('keeps a bare address bare', async () => {
    expect(await typeAfter('see https://example.com now\n', 'now', '!')).toBe(
      'see https://example.com now!\n'
    )
  })

  it('brackets an address the next text would run into', async () => {
    expect(await typeAfter('see https://example.com now\n', 'see ', '')).toBe(
      'see https://example.com now\n'
    )
    const editor = await createEditor('see https://example.com now\n')
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      // Right after the link, outside it: the address would swallow the text.
      const at = 'see https://example.com'.length + 1
      view.dispatch(view.state.tr.insert(at, view.state.schema.text('x')))
    })
    expect(editor.action(getMarkdown())).toBe(
      'see <https://example.com>x now\n'
    )
  })
})
