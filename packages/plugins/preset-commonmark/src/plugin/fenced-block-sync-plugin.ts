import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { fencedBlocksCtx, fencedNodeOf } from '../node/fence'

/// This plugin moves a fence to the node its language belongs to: a code
/// block given a language that a `$fencedBlock` claims becomes that node,
/// and that node given another language becomes a code block again. The
/// text, language, meta and fence go with it.
export const fencedBlockSyncPlugin = $prose((ctx) => {
  return new Plugin({
    key: new PluginKey('MILKDOWN_FENCED_BLOCK_SYNC'),
    appendTransaction: (transactions, _oldState, state) => {
      if (!transactions.some((tr) => tr.docChanged)) return null
      if (!ctx.isInjected(fencedBlocksCtx.key)) return null
      const claims = ctx.get(fencedBlocksCtx.key)
      if (!claims.length) return null

      const fenced = new Set(['code_block', ...claims.map((claim) => claim.id)])
      const tr = state.tr
      state.doc.descendants((node, pos) => {
        if (!fenced.has(node.type.name)) return !node.isTextblock
        const target =
          state.schema.nodes[
            fencedNodeOf(ctx, String(node.attrs.language ?? ''))
          ]
        if (target && target !== node.type)
          tr.setNodeMarkup(pos, target, node.attrs)
        return false
      })
      return tr.docChanged ? tr : null
    },
  })
})

withMeta(fencedBlockSyncPlugin, {
  displayName: 'Prose<fencedBlockSyncPlugin>',
  group: 'Prose',
})
