import type { Ctx } from '@milkdown/ctx'
import type { Node, NodeType } from '@milkdown/prose/model'
import type {
  MarkdownNode,
  ParserState,
  SerializerState,
} from '@milkdown/transformer'

import { $ctx } from '@milkdown/utils'

import { withMeta } from '../__internal__'

/// A node that takes fences of some languages from the code block.
export interface FencedBlockClaim {
  /// The id of the node.
  id: string
  /// Whether a fence with this language (the first word of its info string) is the node's.
  match: (language: string) => boolean
}

/// The nodes that take fences from the code block, in the order they were added.
export const fencedBlocksCtx = $ctx<FencedBlockClaim[], 'fencedBlocks'>(
  [],
  'fencedBlocks'
)

withMeta(fencedBlocksCtx, {
  displayName: 'Ctx<fencedBlocks>',
  group: 'CodeBlock',
})

/// The node a fence with `language` belongs to: a claiming node's id, or `code_block`.
export function fencedNodeOf(ctx: Ctx, language: string): string {
  if (!ctx.isInjected(fencedBlocksCtx.key)) return 'code_block'
  const claim = ctx
    .get(fencedBlocksCtx.key)
    .find((claim) => claim.match(language))
  return claim?.id ?? 'code_block'
}

/// The attrs of a fenced node: what the fence says and how it was written.
export const fenceAttrs = {
  language: {
    default: '',
    validate: 'string',
  },
  /// What follows the language on the fence line (`title="a.py"`).
  meta: {
    default: '',
    validate: 'string',
  },
  /// How the author fenced it: `` ` ``, `~`, or `indent`; empty for the default.
  fence: {
    default: '',
    validate: 'string',
  },
} as const

/// A fenced node's attrs as `data-` attributes, so copy and paste keep them.
export function fenceToDOM(node: Node): Record<string, string> {
  const dom: Record<string, string> = {}
  if (node.attrs.language) dom['data-language'] = node.attrs.language
  if (node.attrs.meta) dom['data-meta'] = node.attrs.meta
  if (node.attrs.fence) dom['data-fence'] = node.attrs.fence
  return dom
}

/// A fenced node's attrs read back from what `fenceToDOM` wrote.
export function fenceFromDOM(dom: HTMLElement) {
  return {
    language: dom.dataset.language ?? '',
    meta: dom.dataset.meta ?? '',
    fence: dom.dataset.fence ?? '',
  }
}

/// Opens a fenced node from an mdast `code` node.
export function readFence(
  state: ParserState,
  node: MarkdownNode,
  type: NodeType
): void {
  const value = node.value as string | null
  state.openNode(type, {
    language: (node.lang as string | null) ?? '',
    meta: (node.meta as string | null) ?? '',
    fence: (node.fence as string | undefined) ?? '',
  })
  if (value) state.addText(value)
  state.closeNode()
}

/// Writes a fenced node back as an mdast `code` node.
export function writeFence(state: SerializerState, node: Node): void {
  state.addNode('code', undefined, node.content.firstChild?.text || '', {
    lang: node.attrs.language,
    ...(node.attrs.meta ? { meta: node.attrs.meta } : {}),
    ...(node.attrs.fence ? { fence: node.attrs.fence } : {}),
  })
}
