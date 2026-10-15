import type { Ctx, MilkdownPlugin } from '@milkdown/ctx'
import type { NodeSchema } from '@milkdown/transformer'
import type { $NodeSchema } from '@milkdown/utils'

import { $nodeSchema } from '@milkdown/utils'

import {
  fenceAttrs,
  fencedBlocksCtx,
  fencedNodeOf,
  readFence,
  writeFence,
} from './fence'

/// What a fenced block adds to its node: anything a node spec holds but its
/// attrs and Markdown, which are a fence's (`language`, `meta`, `fence`).
export type FencedBlockSpec = Omit<
  NodeSchema,
  'attrs' | 'parseMarkdown' | 'toMarkdown'
>

/// @internal
export type $FencedBlock<T extends string> = MilkdownPlugin[] & {
  id: T
  type: $NodeSchema<T>['type']
  schema: $NodeSchema<T>
}

/// A node for the fences of some languages, in place of the code block:
/// a molecule for ` ```smiles `, a diagram for ` ```mermaid `. It reads and
/// writes the fence as the code block does, keeping its language, meta and
/// fence characters, so the Markdown stays as it was written. A code block
/// whose language is changed to a matching one becomes this node, and back.
///
/// ```ts
/// const molecule = $fencedBlock('molecule', (language) => language === 'smiles', () => ({
///   atom: true,
/// }))
/// editor.use(molecule)
/// ```
///
/// Like a code block, its content is the fence's text. `spec` can give it a
/// DOM, make it an atom, and so on; by default it is drawn as
/// `<pre data-fenced-block="id" data-language="…"><code>`.
export function $fencedBlock<T extends string>(
  id: T,
  match: (language: string) => boolean,
  spec: (ctx: Ctx) => FencedBlockSpec = () => ({})
): $FencedBlock<T> {
  const schema = $nodeSchema(id, (ctx) => ({
    content: 'text*',
    group: 'block',
    marks: '',
    defining: true,
    code: true,
    parseDOM: [
      {
        tag: `pre[data-fenced-block="${id}"]`,
        preserveWhitespace: 'full',
        getAttrs: (dom) => ({
          language: (dom as HTMLElement).dataset.language ?? '',
        }),
      },
    ],
    toDOM: (node) => [
      'pre',
      { 'data-fenced-block': id, 'data-language': node.attrs.language },
      ['code', 0],
    ],
    ...spec(ctx),
    attrs: fenceAttrs,
    parseMarkdown: {
      match: (node) =>
        node.type === 'code' &&
        fencedNodeOf(ctx, (node.lang as string | null) ?? '') === id,
      runner: readFence,
    },
    toMarkdown: {
      match: (node) => node.type.name === id,
      runner: writeFence,
    },
  }))

  const claim: MilkdownPlugin = (ctx) => () => {
    const entry = { id, match }
    ctx.update(fencedBlocksCtx.key, (claims) => [...claims, entry])
    return () => {
      if (!ctx.isInjected(fencedBlocksCtx.key)) return
      ctx.update(fencedBlocksCtx.key, (claims) =>
        claims.filter((claim) => claim !== entry)
      )
    }
  }

  const plugins = [claim, ...schema] as $FencedBlock<T>
  plugins.id = id
  plugins.type = schema.type
  plugins.schema = schema
  return plugins
}
