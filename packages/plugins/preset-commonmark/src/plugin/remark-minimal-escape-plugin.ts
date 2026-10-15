import type { Node, RemarkParser, RemarkPluginRaw } from '@milkdown/transformer'

import { $remark } from '@milkdown/utils'
import { visit } from 'unist-util-visit'

import { withMeta } from '../__internal__'

type Positioned = Node & {
  value?: string
  children?: Positioned[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

const PUNCTUATION = /[!-/:-@[-`{-~]/u
const CACHE_LIMIT = 500

/// Where each text node sits in the Markdown: ranges of plain characters.
function textRanges(tree: Positioned): [number, number][] {
  const ranges: [number, number][] = []
  visit(tree, 'text', (node: Positioned) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start != null && end != null) ranges.push([start, end])
  })
  return ranges
}

const inside = (ranges: [number, number][], at: number) =>
  ranges.some(([start, end]) => start <= at && at < end)

/// What Markdown means, without where it is written.
function meaning(tree: Positioned): string {
  return JSON.stringify(tree, (key, value) =>
    key === 'position' || key === 'data' ? undefined : value
  )
}

/// One block with only the backslashes it needs: an escape goes when the
/// character after it stays plain text without it, and the block means the
/// same. `snake\_case` and `5 \* 3` lose theirs; `\*not emphasis\*` keeps both.
export function minimizeEscapes(
  block: string,
  parse: (markdown: string) => Positioned
): string {
  if (!block.includes('\\')) return block
  const before = parse(block)
  const plain = textRanges(before)

  // Escapes inside text, not in code, math or HTML, which write `\` as is.
  const escapes: number[] = []
  for (let index = 0; index < block.length - 1; index += 1) {
    if (block[index] !== '\\') continue
    if (PUNCTUATION.test(block[index + 1]!) && inside(plain, index))
      escapes.push(index)
    index += 1
  }
  if (!escapes.length) return block

  const build = (dropped: Set<number>) => {
    let text = ''
    let last = 0
    const moved = new Map<number, number>()
    for (const escape of escapes) {
      if (!dropped.has(escape)) continue
      text += block.slice(last, escape)
      moved.set(escape, text.length)
      last = escape + 1
    }
    return { text: text + block.slice(last), moved }
  }

  const dropped = new Set(escapes)
  const candidate = build(dropped)
  const ranges = textRanges(parse(candidate.text))
  // The characters that turned into syntax keep their backslash.
  for (const [escape, at] of candidate.moved)
    if (!inside(ranges, at)) dropped.delete(escape)
  if (!dropped.size) return block

  const result = build(dropped).text
  return meaning(parse(result)) === meaning(before) ? result : block
}

function minimalEscape(this: RemarkParser) {
  const compile = this.compiler
  if (!compile) return
  const cache = new Map<string, string>()
  const parse = (text: string) => this.parse(text) as Positioned

  this.compiler = (tree, file) => {
    const markdown = String(compile(tree, file))
    if (!markdown.includes('\\')) return markdown
    const root = parse(markdown)
    let result = ''
    let last = 0
    let changed = false
    for (const child of root.children ?? []) {
      const start = child.position?.start.offset
      const end = child.position?.end.offset
      if (start == null || end == null) continue
      const block = markdown.slice(start, end)
      let written = cache.get(block)
      if (written === undefined) {
        written = minimizeEscapes(block, parse)
        if (cache.size >= CACHE_LIMIT) cache.clear()
        cache.set(block, written)
      }
      result += markdown.slice(last, start) + written
      last = end
      changed ||= written !== block
    }
    if (!changed) return markdown
    result += markdown.slice(last)
    // A block read alone can miss what the rest of the document defines.
    return meaning(parse(result)) === meaning(root) ? result : markdown
  }
}

/// This plugin writes only the backslashes Markdown needs. remark escapes
/// every `*`, `_` and `[` that could start something; in science writing
/// those are mostly `k_B`, `2 * 3` and `[Cu(NH3)4]2+`, and an edited block
/// would come back full of backslashes.
export const remarkMinimalEscape = $remark(
  'remarkMinimalEscape',
  () => minimalEscape as unknown as RemarkPluginRaw<unknown>
)

withMeta(remarkMinimalEscape.plugin, {
  displayName: 'Remark<remarkMinimalEscape>',
  group: 'Remark',
})

withMeta(remarkMinimalEscape.options, {
  displayName: 'RemarkConfig<remarkMinimalEscape>',
  group: 'Remark',
})
