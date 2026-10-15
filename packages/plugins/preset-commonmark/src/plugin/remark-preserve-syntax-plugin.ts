import type { Node, RemarkParser, RemarkPluginRaw } from '@milkdown/transformer'
import type { Handle, Info, Options, State } from 'mdast-util-to-markdown'

import { $remark } from '@milkdown/utils'
import { defaultHandlers } from 'mdast-util-to-markdown'
import { visit } from 'unist-util-visit'

import { withMeta } from '../__internal__'

type Positioned = Node & {
  position?: { start: { offset?: number }; end: { offset?: number } }
}

type Syntax = Positioned & {
  ordered?: boolean
  children?: Positioned[]
  bullet?: string
  delimiter?: string
  increment?: boolean
  style?: string
  setext?: boolean
  fence?: string
  marker?: string
  literal?: boolean
  url?: string
}

/// Runs `handle` with some stringify options changed, then puts them back.
function withOptions(state: State, options: Options, handle: () => string) {
  const saved: Record<string, unknown> = {}
  const current = state.options as Record<string, unknown>
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    saved[key] = current[key]
    current[key] = value
  }
  try {
    return handle()
  } finally {
    Object.assign(current, saved)
  }
}

/// How a thematic break was written (`---`, `* * *`) as stringify options.
function ruleOptions(marker: string): Options {
  const rule = marker.replace(/\s/g, '')
  const char = rule.charAt(0)
  if (!['*', '-', '_'].includes(char) || rule.length < 3) return {}
  return {
    rule: char as Options['rule'],
    ruleRepetition: rule.length,
    ruleSpaces: /\s/.test(marker),
  }
}

/// The text of a link that is only its address, as GFM finds it in running text.
function literalText(node: Syntax): string | null {
  const children = node.children as (Node & { value?: string })[] | undefined
  if (children?.length !== 1 || children[0]!.type !== 'text') return null
  const text = children[0]!.value ?? ''
  const url = node.url ?? ''
  if (url === text || url === `http://${text}` || url === `mailto:${text}`)
    return text
  return null
}

const handlers: Partial<Record<string, Handle>> = {
  list: (node: Syntax, parent, state, info) =>
    withOptions(
      state,
      node.ordered
        ? {
            bulletOrdered: (node.delimiter || undefined) as
              | Options['bulletOrdered']
              | undefined,
            incrementListMarker: node.increment !== false,
          }
        : { bullet: (node.bullet || undefined) as Options['bullet'] },
      () => defaultHandlers.list(node as never, parent, state, info)
    ),
  break: (node: Syntax, parent, state, info) => {
    const value = defaultHandlers.break(node as never, parent, state, info)
    return value === '\\\n' && node.style === 'spaces' ? '  \n' : value
  },
  heading: (node: Syntax, parent, state, info) =>
    withOptions(state, { setext: node.setext }, () =>
      defaultHandlers.heading(node as never, parent, state, info)
    ),
  code: (node: Syntax, parent, state, info) => {
    const options: Options =
      node.fence === 'indent'
        ? { fences: false }
        : node.fence === '~' || node.fence === '`'
          ? { fence: node.fence }
          : {}
    return withOptions(state, options, () =>
      defaultHandlers.code(node as never, parent, state, info)
    )
  },
  thematicBreak: (node: Syntax, parent, state) =>
    withOptions(state, ruleOptions(node.marker ?? ''), () =>
      defaultHandlers.thematicBreak(node as never, parent, state)
    ),
  link: (node: Syntax, parent, state, info: Info) => {
    const text = node.literal ? literalText(node) : null
    // A bare address stays bare only where GFM would find it again.
    if (
      text &&
      /^$|[\s*_~(]$/u.test(info.before) &&
      /^$|^[\s.,:;!?"')*_~<]/u.test(info.after)
    )
      return text
    return defaultHandlers.link(node as never, parent, state, info)
  },
}

function preserveSyntax(this: RemarkParser) {
  const data = this.data() as { toMarkdownExtensions?: unknown[] }
  ;(data.toMarkdownExtensions ??= []).push({ handlers })

  return (tree: Node, file: { value?: unknown }) => {
    const source = String(file.value ?? '')
    const at = (node: Positioned) => node.position?.start.offset
    const raw = (node: Positioned) => {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      return start == null || end == null ? '' : source.slice(start, end)
    }

    visit(tree, (node: Syntax) => {
      const start = at(node)
      if (start == null) return
      switch (node.type) {
        case 'list': {
          const items = (node.children ?? []).map((item) => {
            const offset = at(item) ?? 0
            return source.slice(offset, offset + 12)
          })
          if (!node.ordered) {
            const bullet = items[0]?.charAt(0)
            if (bullet && '-*+'.includes(bullet)) node.bullet = bullet
            break
          }
          const numbers = items.map((item) => /^(\d{1,9})([.)])/u.exec(item))
          if (numbers[0]) node.delimiter = numbers[0][2]
          if (
            numbers.length > 1 &&
            numbers.every((match) => match && match[1] === numbers[0]![1])
          )
            node.increment = false
          break
        }
        case 'break':
          node.style = source.charAt(start) === '\\' ? 'backslash' : 'spaces'
          break
        case 'heading':
          node.setext = !/^\s*#/u.test(raw(node))
          break
        case 'code': {
          const fence = /^\s*(`{3,}|~{3,})/u.exec(raw(node))
          node.fence = fence ? fence[1]!.charAt(0) : 'indent'
          break
        }
        case 'thematicBreak':
          node.marker = raw(node).trim()
          break
        case 'link': {
          const first = source.charAt(start)
          node.literal = first !== '[' && first !== '<'
          break
        }
      }
    })
  }
}

/// This plugin keeps how the author wrote things the editor does not show:
/// list bullets (`-`, `*`, `+`) and delimiters (`1.`, `1)`), numbering that
/// does not count up (`1. 1.`), hard breaks as two spaces, setext headings,
/// `~~~` and indented code, thematic break markers and bare addresses.
/// Parsing notes the written form on the node; writing uses it again.
export const remarkPreserveSyntax = $remark(
  'remarkPreserveSyntax',
  () => preserveSyntax as unknown as RemarkPluginRaw<unknown>
)

withMeta(remarkPreserveSyntax.plugin, {
  displayName: 'Remark<remarkPreserveSyntax>',
  group: 'Remark',
})

withMeta(remarkPreserveSyntax.options, {
  displayName: 'RemarkConfig<remarkPreserveSyntax>',
  group: 'Remark',
})
