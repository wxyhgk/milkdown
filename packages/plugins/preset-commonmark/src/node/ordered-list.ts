import { commandsCtx } from '@milkdown/core'
import { expectDomTypeError } from '@milkdown/exception'
import { wrapIn } from '@milkdown/prose/commands'
import { wrappingInputRule } from '@milkdown/prose/inputrules'
import {
  $command,
  $inputRule,
  $nodeAttr,
  $nodeSchema,
  $useKeymap,
} from '@milkdown/utils'

import { withMeta } from '../__internal__'

/// HTML attributes for ordered list node.
export const orderedListAttr = $nodeAttr('orderedList')

withMeta(orderedListAttr, {
  displayName: 'Attr<orderedList>',
  group: 'OrderedList',
})

/// Schema for ordered list node.
export const orderedListSchema = $nodeSchema('ordered_list', (ctx) => ({
  content: 'listItem+',
  group: 'block',
  attrs: {
    order: {
      default: 1,
      validate: 'number',
    },
    spread: {
      default: false,
      validate: 'boolean',
    },
    /// The delimiter the author wrote (`.` or `)`); empty for the default.
    delimiter: {
      default: '',
      validate: 'string',
    },
    /// False when every item was written with the same number (`1. 1. 1.`).
    increment: {
      default: true,
      validate: 'boolean',
    },
  },
  parseDOM: [
    {
      tag: 'ol',
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)

        return {
          spread: dom.dataset.spread === 'true',
          delimiter: dom.dataset.delimiter ?? '',
          increment: dom.dataset.increment !== 'false',
          order: dom.hasAttribute('start')
            ? Number(dom.getAttribute('start'))
            : 1,
        }
      },
    },
  ],
  toDOM: (node) => [
    'ol',
    {
      ...ctx.get(orderedListAttr.key)(node),
      ...(node.attrs.order === 1 ? {} : { start: node.attrs.order }),
      'data-spread': node.attrs.spread,
      ...(node.attrs.delimiter
        ? { 'data-delimiter': node.attrs.delimiter }
        : {}),
      ...(node.attrs.increment ? {} : { 'data-increment': 'false' }),
    },
    0,
  ],
  parseMarkdown: {
    match: ({ type, ordered }) => type === 'list' && !!ordered,
    runner: (state, node, type) => {
      const spread = node.spread ?? true
      state
        .openNode(type, {
          spread,
          order: node.start ?? 1,
          delimiter: (node.delimiter as string | undefined) ?? '',
          increment: node.increment !== false,
        })
        .next(node.children)
        .closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'ordered_list',
    runner: (state, node) => {
      state.openNode('list', undefined, {
        ordered: true,
        start: node.attrs.order ?? 1,
        spread: node.attrs.spread,
        ...(node.attrs.delimiter ? { delimiter: node.attrs.delimiter } : {}),
        ...(node.attrs.increment ? {} : { increment: false }),
      })
      state.next(node.content)
      state.closeNode()
    },
  },
}))

withMeta(orderedListSchema.node, {
  displayName: 'NodeSchema<orderedList>',
  group: 'OrderedList',
})

withMeta(orderedListSchema.ctx, {
  displayName: 'NodeSchemaCtx<orderedList>',
  group: 'OrderedList',
})

/// Input rule for wrapping a block in ordered list node.
export const wrapInOrderedListInputRule = $inputRule((ctx) =>
  wrappingInputRule(
    /^\s*(\d+)\.\s$/,
    orderedListSchema.type(ctx),
    (match) => ({ order: Number(match[1]) }),
    (match, node) => node.childCount + node.attrs.order === Number(match[1])
  )
)

withMeta(wrapInOrderedListInputRule, {
  displayName: 'InputRule<wrapInOrderedListInputRule>',
  group: 'OrderedList',
})

/// Command for wrapping a block in ordered list node.
export const wrapInOrderedListCommand = $command(
  'WrapInOrderedList',
  (ctx) => () => wrapIn(orderedListSchema.type(ctx))
)

withMeta(wrapInOrderedListCommand, {
  displayName: 'Command<wrapInOrderedListCommand>',
  group: 'OrderedList',
})

/// Keymap for ordered list node.
/// - `Mod-Alt-7`: Wrap a block in ordered list.
export const orderedListKeymap = $useKeymap('orderedListKeymap', {
  WrapInOrderedList: {
    shortcuts: 'Mod-Alt-7',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(wrapInOrderedListCommand.key)
    },
  },
})

withMeta(orderedListKeymap.ctx, {
  displayName: 'KeymapCtx<orderedList>',
  group: 'OrderedList',
})

withMeta(orderedListKeymap.shortcuts, {
  displayName: 'Keymap<orderedList>',
  group: 'OrderedList',
})
