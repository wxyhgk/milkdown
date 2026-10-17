import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { describe, expect, test } from 'vitest'

import { Crepe } from '../core'

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

describe('a new list item', () => {
  test('keeps what is typed before its first frame where it was typed', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const crepe = new Crepe({ root, defaultValue: 'Item' })
    await crepe.create()
    const view = crepe.editor.ctx.get(editorViewCtx)
    const { schema } = view.state
    const end = view.state.doc.content.size - 1
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, end))
    )

    // The paragraph becomes a list item, whose view draws the cursor a frame later…
    const range = view.state.selection.$from.blockRange()!
    view.dispatch(
      view.state.tr.wrap(range, [
        { type: schema.nodes.bullet_list! },
        { type: schema.nodes.list_item! },
      ])
    )
    // …and keys come in before that frame.
    view.dispatch(view.state.tr.insertText('ab'))
    await nextFrame()
    await nextFrame()
    view.dispatch(view.state.tr.insertText('c'))

    expect(view.state.selection.$from.parent.textContent).toBe('Itemabc')
    await crepe.destroy()
  })
})
