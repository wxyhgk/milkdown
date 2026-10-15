import type { MilkdownPlugin } from '@milkdown/ctx'

import {
  fencedBlockSyncPlugin,
  hardbreakClearMarkPlugin,
  hardbreakFilterNodes,
  hardbreakFilterPlugin,
  inlineNodesCursorPlugin,
  remarkAddOrderInListPlugin,
  remarkHtmlTransformer,
  remarkInlineLinkPlugin,
  remarkLineBreak,
  remarkMarker,
  remarkMinimalEscape,
  remarkPreserveEmptyLinePlugin,
  remarkPreserveSyntax,
  syncHeadingIdPlugin,
  syncListOrderPlugin,
} from '../plugin'

/// @internal
export const plugins: MilkdownPlugin[] = [
  hardbreakClearMarkPlugin,
  hardbreakFilterNodes,
  hardbreakFilterPlugin,

  inlineNodesCursorPlugin,

  remarkAddOrderInListPlugin,
  remarkInlineLinkPlugin,
  remarkLineBreak,
  remarkHtmlTransformer,
  remarkMarker,
  remarkPreserveEmptyLinePlugin,
  remarkPreserveSyntax,
  remarkMinimalEscape,

  syncHeadingIdPlugin,
  syncListOrderPlugin,
  fencedBlockSyncPlugin,
].flat()
