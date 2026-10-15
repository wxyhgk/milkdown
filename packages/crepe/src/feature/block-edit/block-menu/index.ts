import type { Ctx } from '@milkdown/kit/ctx'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

import {
  NodeSelection,
  Plugin,
  PluginKey,
  type PluginView,
} from '@milkdown/kit/prose/state'
import { $ctx, $prose } from '@milkdown/kit/utils'
import { createApp, nextTick, ref, type App } from 'vue'

import type { MenuItemGroup } from '../../../utils/group-builder'

import { GroupBuilder } from '../../../utils/group-builder'
import { BlockMenu } from './component'

/// An entry of the block menu.
export type BlockMenuItem = {
  label: string
  icon?: string
  /// Marks what the block is now, such as its kind among "turn into" entries.
  current?: boolean
  /// Marks an entry that removes something.
  danger?: boolean
}

/// The block a menu is open for.
export interface BlockMenuTarget {
  node: ProseNode
  /// The position before the block.
  pos: number
}

/// Builds the menu for a block, each time it opens. Add nothing to leave it closed.
export type BuildBlockMenu = (
  builder: GroupBuilder<BlockMenuItem>,
  target: BlockMenuTarget
) => void

/// What the block menu shows, set through the block edit feature's `buildBlockMenu`.
export const blockMenuConfig = $ctx<
  { build: BuildBlockMenu | null },
  'blockMenuConfigCtx'
>({ build: null }, 'blockMenuConfigCtx')

interface BlockMenuAPI {
  /// Opens the menu for the block at `pos`, next to `anchor`, selecting the block;
  /// or closes it when it is open there already.
  toggle: (pos: number, anchor: HTMLElement) => void
  hide: () => void
}

/// Opens the block menu from elsewhere, such as a button inside a node view.
export const blockMenuAPI = $ctx<BlockMenuAPI, 'blockMenuAPICtx'>(
  { toggle: () => {}, hide: () => {} },
  'blockMenuAPICtx'
)

/// Lays the groups out for the menu: every item gets its index, every group the range of them.
function indexGroups(groups: ReturnType<GroupBuilder<BlockMenuItem>['build']>) {
  let index = 0
  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const start = index
      const items = group.items.map((item) => ({ ...item, index: index++ }))
      return { ...group, items, range: [start, index] }
    }) as MenuItemGroup<BlockMenuItem>[]
}

/// The part of the window that boxes around `element` leave visible.
function visibleBounds(element: HTMLElement) {
  const bounds = {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  }
  for (let box = element.parentElement; box; box = box.parentElement) {
    const style = window.getComputedStyle(box)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    const rect = box.getBoundingClientRect()
    bounds.top = Math.max(bounds.top, rect.top)
    bounds.left = Math.max(bounds.left, rect.left)
    bounds.right = Math.min(bounds.right, rect.right)
    bounds.bottom = Math.min(bounds.bottom, rect.bottom)
  }
  return bounds
}

class BlockMenuView implements PluginView {
  readonly #ctx: Ctx
  readonly #view: EditorView
  readonly #content: HTMLElement
  readonly #app: App
  readonly #groups = ref<MenuItemGroup<BlockMenuItem>[]>([])
  readonly #show = ref(false)
  #target: BlockMenuTarget | null = null
  #anchor: HTMLElement | null = null

  constructor(ctx: Ctx, view: EditorView) {
    this.#ctx = ctx
    this.#view = view
    const content = document.createElement('div')
    content.className = 'milkdown-block-menu'
    content.dataset.show = 'false'
    content.setAttribute('role', 'menu')
    content.tabIndex = -1
    this.#app = createApp(BlockMenu, {
      groups: this.#groups,
      show: this.#show,
      run: this.#run,
      hide: this.hide,
    })
    this.#app.mount(content)
    this.#content = content
    ;(view.dom.parentElement ?? document.body).appendChild(content)

    document.addEventListener('pointerdown', this.#onPointerDown, true)
    document.addEventListener('scroll', this.#onScroll, true)
    ctx.set(blockMenuAPI.key, { toggle: this.toggle, hide: this.hide })
  }

  /// Closes once the selection leaves the block or the block changes.
  update = (view: EditorView) => {
    const target = this.#target
    if (!target) return
    const { from, to } = view.state.selection
    const node = view.state.doc.nodeAt(target.pos)
    if (
      node !== target.node ||
      from < target.pos ||
      to > target.pos + target.node.nodeSize
    )
      this.hide()
  }

  toggle = (pos: number, anchor: HTMLElement) => {
    if (this.#target?.pos === pos) {
      this.hide()
      return
    }
    const node = this.#view.state.doc.nodeAt(pos)
    const build = this.#ctx.get(blockMenuConfig.key).build
    if (!node || !build) return
    const builder = new GroupBuilder<BlockMenuItem>()
    build(builder, { node, pos })
    const groups = indexGroups(builder.build())
    if (!groups.length) {
      this.hide()
      return
    }
    // The menu acts on its block: select it, unless the selection is in it already.
    const { from, to } = this.#view.state.selection
    if (
      (from < pos || to > pos + node.nodeSize) &&
      NodeSelection.isSelectable(node)
    )
      this.#view.dispatch(
        this.#view.state.tr
          .setSelection(NodeSelection.create(this.#view.state.doc, pos))
          .setMeta('addToHistory', false)
      )
    this.#groups.value = groups
    this.#target = { node, pos }
    this.#anchor = anchor
    this.#show.value = true
    this.#content.dataset.show = 'true'
    // Measured once Vue has drawn the entries.
    void nextTick(() => {
      if (this.#anchor === anchor) this.#place(anchor)
    })
    // Focus moves into the menu, as in any menu. While the editor kept it, the
    // browser's late report of an earlier caret could move the selection off
    // the block, which closes the menu again.
    this.#content.focus({ preventScroll: true })
  }

  hide = () => {
    if (!this.#target) return
    this.#target = null
    this.#anchor = null
    this.#show.value = false
    this.#content.dataset.show = 'false'
    if (this.#content.contains(document.activeElement)) this.#view.focus()
  }

  destroy = () => {
    document.removeEventListener('pointerdown', this.#onPointerDown, true)
    document.removeEventListener('scroll', this.#onScroll, true)
    this.#app.unmount()
    this.#content.remove()
  }

  /// Beside the anchor, on whichever side fits, inside what can be seen of
  /// the editor: the window, less any scrolling or clipping box it sits in.
  #place(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect()
    const style = this.#content.style
    style.left = '0px'
    style.top = '0px'
    // Where (0, 0) puts it: the menu sits in the editor, whatever offsets that.
    const origin = this.#content.getBoundingClientRect()
    const { width, height } = origin
    const bounds = visibleBounds(this.#content)
    let left = rect.right + 8
    if (left + width > bounds.right - 8) left = rect.left - width - 8
    left = Math.max(bounds.left + 8, Math.min(left, bounds.right - width - 8))
    const top = Math.max(
      bounds.top + 8,
      Math.min(rect.top, bounds.bottom - height - 8)
    )
    style.left = `${left - origin.left}px`
    style.top = `${top - origin.top}px`
  }

  #run = (onRun: ((ctx: Ctx) => void) | undefined) => {
    this.hide()
    onRun?.(this.#ctx)
  }

  #onPointerDown = (event: PointerEvent) => {
    if (!this.#target || !(event.target instanceof Node)) return
    // A press on what opened the menu toggles it when released.
    if (
      this.#content.contains(event.target) ||
      this.#anchor?.contains(event.target)
    )
      return
    this.hide()
  }

  #onScroll = (event: Event) => {
    if (event.target instanceof Node && this.#content.contains(event.target))
      return
    this.hide()
  }
}

/// The menu a block opens: from a click on the drag handle, or `blockMenuAPI`.
export const blockMenu = $prose(
  (ctx) =>
    new Plugin({
      key: new PluginKey('CREPE_BLOCK_MENU'),
      view: (view) => new BlockMenuView(ctx, view),
    })
)
