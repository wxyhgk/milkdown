import { Icon } from '@milkdown/kit/component'
import { defineComponent, ref, h, Fragment } from 'vue'

import { keepAlive } from '../../../utils/keep-alive'

keepAlive(h, Fragment)

interface BlockHandleProps {
  onAdd: () => void
  /// A click on the drag handle, not a drag.
  onMenu: (anchor: HTMLElement) => void
  addIcon: string
  handleIcon: string
}

export const BlockHandle = defineComponent<BlockHandleProps>({
  props: {
    onAdd: {
      type: Function,
      required: true,
    },
    onMenu: {
      type: Function,
      required: true,
    },
    addIcon: {
      type: String,
      required: true,
    },
    handleIcon: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const addButton = ref<HTMLDivElement>()
    let press: { x: number; y: number } | null = null

    return () => {
      return (
        <>
          <div
            ref={addButton}
            class="operation-item"
            onPointerdown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              addButton.value?.classList.add('active')
            }}
            onPointerup={(e) => {
              e.preventDefault()
              e.stopPropagation()
              addButton.value?.classList.remove('active')
              props.onAdd()
            }}
          >
            <Icon icon={props.addIcon} />
          </div>
          <div
            class="operation-item"
            onPointerdown={(e) => {
              press = { x: e.clientX, y: e.clientY }
            }}
            onPointerup={(e) => {
              const start = press
              press = null
              if (!start) return
              // A drag moves the block; only a still click opens the menu.
              if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4)
                return
              props.onMenu(e.currentTarget as HTMLElement)
            }}
          >
            <Icon icon={props.handleIcon} />
          </div>
        </>
      )
    }
  },
})
