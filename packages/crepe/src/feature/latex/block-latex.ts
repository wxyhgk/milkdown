import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'

import { MATH_BLOCK_FENCE } from './constants'

export const blockLatexSchema = codeBlockSchema.extendSchema((prev) => {
  return (ctx) => {
    const baseSchema = prev(ctx)
    return {
      ...baseSchema,
      toMarkdown: {
        match: baseSchema.toMarkdown.match,
        runner: (state, node) => {
          const language = node.attrs.language ?? ''
          // A ```latex fence stays one: only a block of math is written as `$$`.
          if (
            language.toLowerCase() === 'latex' &&
            node.attrs.fence === MATH_BLOCK_FENCE
          ) {
            state.addNode(
              'math',
              undefined,
              node.content.firstChild?.text || '',
              node.attrs.meta ? { meta: node.attrs.meta } : undefined
            )
          } else {
            return baseSchema.toMarkdown.runner(state, node)
          }
        },
      },
    }
  }
})
