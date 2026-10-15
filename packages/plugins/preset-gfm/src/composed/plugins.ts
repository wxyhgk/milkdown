import type { MilkdownPlugin } from '@milkdown/ctx'

import {
  autoInsertSpanPlugin,
  keepTableAlignPlugin,
  remarkGFMPlugin,
  remarkPreserveTable,
  tableEditingPlugin,
} from '../plugin'

/// @internal
export const plugins: MilkdownPlugin[] = [
  keepTableAlignPlugin,
  autoInsertSpanPlugin,
  remarkGFMPlugin,
  remarkPreserveTable,
  tableEditingPlugin,
].flat()
