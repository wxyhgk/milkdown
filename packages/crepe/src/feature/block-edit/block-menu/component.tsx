import type { Ctx } from '@milkdown/kit/ctx'

import { Icon } from '@milkdown/kit/component'
import { defineComponent, h, onUnmounted, ref, watch, type Ref } from 'vue'

import type { MenuItemGroup } from '../../../utils/group-builder'
import type { BlockMenuItem } from './index'

import { keepAlive } from '../../../utils/keep-alive'

keepAlive(h)

type BlockMenuProps = {
  groups: Ref<MenuItemGroup<BlockMenuItem>[]>
  show: Ref<boolean>
  run: (onRun: ((ctx: Ctx) => void) | undefined) => void
  hide: () => void
}

/// The block menu's entries, in groups. The editor keeps focus: arrows move,
/// Enter runs, Escape closes, and other keys do nothing while it is open,
/// since the block under it is selected and a letter would replace it.
export const BlockMenu = defineComponent<BlockMenuProps>({
  props: {
    groups: { type: Object, required: true },
    show: { type: Object, required: true },
    run: { type: Function, required: true },
    hide: { type: Function, required: true },
  },
  setup({ groups, show, run, hide }) {
    const hoverIndex = ref(0)
    const items = () => groups.value.flatMap((group) => group.items)

    const runByIndex = (index: number) => run(items().at(index)?.onRun)

    const onKeydown = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const size = items().length
      if (e.key === 'Escape') hide()
      else if (e.key === 'ArrowDown')
        hoverIndex.value = Math.min(size - 1, hoverIndex.value + 1)
      else if (e.key === 'ArrowUp')
        hoverIndex.value = Math.max(0, hoverIndex.value - 1)
      else if (e.key === 'Enter') runByIndex(hoverIndex.value)
      else if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      e.stopPropagation()
    }

    watch(
      show,
      (shown) => {
        hoverIndex.value = 0
        if (shown)
          window.addEventListener('keydown', onKeydown, { capture: true })
        else window.removeEventListener('keydown', onKeydown, { capture: true })
      },
      { immediate: true, flush: 'sync' }
    )
    onUnmounted(() => {
      window.removeEventListener('keydown', onKeydown, { capture: true })
    })

    return () => (
      <div class="menu-groups" onPointerdown={(e) => e.preventDefault()}>
        {groups.value.map((group) => (
          <div key={group.key} class="menu-group">
            {group.label ? <h6>{group.label}</h6> : null}
            <ul>
              {group.items.map((item) => (
                <li
                  key={item.key}
                  role="menuitem"
                  data-key={item.key}
                  data-index={item.index}
                  class={[
                    hoverIndex.value === item.index ? 'hover' : '',
                    item.current ? 'current' : '',
                    item.danger ? 'danger' : '',
                  ]}
                  onPointerenter={() => (hoverIndex.value = item.index)}
                  onPointerup={() => runByIndex(item.index)}
                >
                  {item.icon ? <Icon icon={item.icon} /> : null}
                  <span>{item.label}</span>
                  {item.hint ? <kbd class="hint">{item.hint}</kbd> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  },
})
