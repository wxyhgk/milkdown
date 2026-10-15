import '@testing-library/jest-dom/vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import { describe, expect, test } from 'vitest'

import type { BlockEditFeatureConfig } from '.'

import { Crepe } from '../../core'
import { CrepeFeature } from '../index'
import { blockMenuAPI } from './block-menu'

async function createCrepe(blockEdit: BlockEditFeatureConfig) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const crepe = new Crepe({
    root,
    defaultValue: 'First\n\n## Second\n',
    featureConfigs: { [CrepeFeature.BlockEdit]: blockEdit },
  })
  await crepe.create()
  const ctx = crepe.editor.ctx
  const view = ctx.get(editorViewCtx)
  const menu = () => root.querySelector<HTMLElement>('.milkdown-block-menu')!
  const anchor = document.createElement('button')
  const open = (pos: number) => ctx.get(blockMenuAPI.key).toggle(pos, anchor)
  const key = (name: string) =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, cancelable: true })
    )
  return { crepe, view, menu, open, key }
}

describe('block menu', () => {
  test('builds its entries for the block it opens on', async () => {
    const seen: string[] = []
    const { menu, open, view } = await createCrepe({
      buildBlockMenu: (builder, { node }) => {
        seen.push(node.type.name)
        builder.addGroup('turn', 'Turn into').addItem('heading', {
          label: 'Heading',
          current: node.type.name === 'heading',
        })
        builder.addGroup('actions', '').addItem('delete', {
          label: 'Delete',
          danger: true,
        })
      },
    })

    const second = view.state.doc.firstChild!.nodeSize
    open(second)
    await Promise.resolve()
    expect(seen).toEqual(['heading'])
    expect(menu().dataset.show).toBe('true')
    expect(menu().querySelector('h6')).toHaveTextContent('Turn into')
    expect(menu().querySelector('[data-key="heading"]')).toHaveClass('current')
    expect(menu().querySelector('[data-key="delete"]')).toHaveClass('danger')

    open(second)
    expect(menu().dataset.show).toBe('false')
  })

  test('the keyboard moves through it, runs an entry and closes it', async () => {
    const ran: string[] = []
    const { menu, open, key } = await createCrepe({
      buildBlockMenu: (builder, { pos }) => {
        builder
          .addGroup('all', '')
          .addItem('one', { label: 'One', onRun: () => ran.push(`one@${pos}`) })
          .addItem('two', { label: 'Two', onRun: () => ran.push(`two@${pos}`) })
      },
    })

    open(0)
    key('ArrowDown')
    key('Enter')
    expect(ran).toEqual(['two@0'])
    expect(menu().dataset.show).toBe('false')

    open(0)
    key('Escape')
    expect(ran).toEqual(['two@0'])
    expect(menu().dataset.show).toBe('false')
  })

  test('without buildBlockMenu, or with nothing in it, it stays closed', async () => {
    const plain = await createCrepe({})
    plain.open(0)
    expect(plain.menu().dataset.show).toBe('false')

    const empty = await createCrepe({ buildBlockMenu: () => {} })
    empty.open(0)
    expect(empty.menu().dataset.show).toBe('false')
  })
})
