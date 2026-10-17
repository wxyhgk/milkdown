import '@testing-library/jest-dom/vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import { describe, expect, test } from 'vitest'

import type { BlockEditFeatureConfig } from '.'

import { Crepe } from '../../core'
import { CrepeFeature } from '../index'
import { blockMenuAPI, type BlockMenuPlacement } from './block-menu'

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
          hint: 'Del',
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
    expect(menu().querySelector('[data-key="delete"] .hint')).toHaveTextContent('Del')
    expect(menu().querySelector('[data-key="heading"] .hint')).toBeNull()

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

  test('opens beside its anchor, or below it as a dropdown', async () => {
    const { crepe, menu } = await createCrepe({
      buildBlockMenu: (builder) => {
        builder.addGroup('actions', '').addItem('delete', { label: 'Delete' })
      },
    })
    const ctx = crepe.editor.ctx
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect
    const anchor = document.createElement('button')
    anchor.getBoundingClientRect = () => rect(100, 200, 40, 30)
    menu().getBoundingClientRect = () => rect(0, 0, 180, 100)
    const placed = async (placement?: BlockMenuPlacement) => {
      ctx.get(blockMenuAPI.key).toggle(1, anchor, placement)
      await new Promise((resolve) => setTimeout(resolve))
      const at = [menu().style.left, menu().style.top]
      ctx.get(blockMenuAPI.key).hide()
      return at
    }
    expect(await placed()).toEqual(['148px', '200px'])
    expect(await placed('below')).toEqual(['100px', '234px'])
  })
})
