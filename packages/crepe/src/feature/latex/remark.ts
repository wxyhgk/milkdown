import type { Node } from '@milkdown/kit/transformer'

import { $remark } from '@milkdown/kit/utils'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'

import { MATH_BLOCK_FENCE } from './constants'

export const remarkMathPlugin = $remark<'remarkMath', undefined>(
  'remarkMath',
  () => remarkMath
)

function visitMathBlock(ast: Node) {
  return visit(
    ast,
    'math',
    (
      node: Node & { value: string },
      index: number,
      parent: Node & { children: Node[] }
    ) => {
      const { value, meta } = node as Node & { value: string; meta?: string }
      const newNode = {
        type: 'code',
        lang: 'LaTeX',
        meta,
        // Written back as `$$`, unlike a ```latex fence.
        fence: MATH_BLOCK_FENCE,
        value,
      }
      parent.children.splice(index, 1, newNode)
    }
  )
}

/// Turn math block into code block with language LaTeX, fenced with `$$`.
export const remarkMathBlockPlugin = $remark(
  'remarkMathBlock',
  () => () => visitMathBlock
)
