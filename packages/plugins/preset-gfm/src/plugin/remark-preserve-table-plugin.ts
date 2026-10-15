import type { Node, RemarkParser, RemarkPluginRaw } from '@milkdown/transformer'
import type { Handle } from 'mdast-util-to-markdown'

import { $remark } from '@milkdown/utils'
import { gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { visit } from 'unist-util-visit'

import { withMeta } from '../__internal__'

type Table = Node & {
  align?: (string | null)[]
  pipeAlign?: string
  delimiter?: string
  position?: {
    start: { line: number; column: number }
    end: { line: number }
  }
}

const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u

/// How wide text looks in a monospaced font: CJK characters take two columns.
export function displayWidth(text: string): number {
  let width = 0
  for (const char of text) width += WIDE.test(char) ? 2 : 1
  return width
}

/// The columns of a row's pipes, counting characters with `measure`.
function pipeColumns(line: string, measure: (text: string) => number) {
  const columns: number[] = []
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '\\') index += 1
    else if (line[index] === '|') columns.push(measure(line.slice(0, index)))
  }
  return columns.join(',')
}

/// `length` or `width` when every row puts its pipes in the same columns.
function pipeAlignOf(lines: string[]): string {
  const same = (measure: (text: string) => number) =>
    new Set(lines.map((line) => pipeColumns(line, measure))).size === 1
  if (same((text) => text.length)) return 'length'
  if (same(displayWidth)) return 'width'
  return 'none'
}

/// The alignment a delimiter row gives each column.
function alignOf(delimiter: string): (string | null)[] {
  return delimiter
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => {
      const text = cell.trim()
      const left = text.startsWith(':')
      const right = text.endsWith(':')
      return left && right ? 'center' : left ? 'left' : right ? 'right' : null
    })
}

const writers = {
  length: gfmTableToMarkdown({}).handlers!.table as Handle,
  width: gfmTableToMarkdown({ stringLength: displayWidth }).handlers!
    .table as Handle,
  none: gfmTableToMarkdown({ tablePipeAlign: false }).handlers!.table as Handle,
}

const table: Handle = (node: Table, parent, state, info) => {
  const style = node.pipeAlign as keyof typeof writers | undefined
  const written = (writers[style ?? 'length'] ?? writers.length)(
    node as never,
    parent,
    state,
    info
  )
  if (style !== 'none' || !node.delimiter) return written
  // Unpadded tables keep their delimiter row while the columns stay the same.
  const align = (node.align ?? []).map((value) => value ?? null)
  const kept = alignOf(node.delimiter)
  if (kept.join() !== align.join()) return written
  const lines = written.split('\n')
  if (lines.length < 2) return written
  lines[1] = node.delimiter.trim()
  return lines.join('\n')
}

function preserveTable(this: RemarkParser) {
  const data = this.data() as { toMarkdownExtensions?: unknown[] }
  ;(data.toMarkdownExtensions ??= []).push({ handlers: { table } })

  return (tree: Node, file: { value?: unknown }) => {
    const source = String(file.value ?? '').split(/\r?\n/u)
    visit(tree, 'table', (node: Table) => {
      const position = node.position
      if (!position) return
      const column = position.start.column - 1
      const lines = source
        .slice(position.start.line - 1, position.end.line)
        .map((line) => line.slice(column).trimEnd())
      if (lines.length < 2) return
      node.pipeAlign = pipeAlignOf(lines)
      node.delimiter = lines[1]
    })
  }
}

/// This plugin keeps how the author laid out a table: pipes padded into
/// columns (by characters or by CJK display width) or not, and the delimiter
/// row of an unpadded table. Without it every table is padded on save.
export const remarkPreserveTable = $remark(
  'remarkPreserveTable',
  () => preserveTable as unknown as RemarkPluginRaw<unknown>
)

withMeta(remarkPreserveTable.plugin, {
  displayName: 'Remark<remarkPreserveTable>',
  group: 'Remark',
})

withMeta(remarkPreserveTable.options, {
  displayName: 'RemarkConfig<remarkPreserveTable>',
  group: 'Remark',
})
