export type SlashMenuItem = {
  label: string
  icon: string
  /// Other words the item is found by, besides its label: `code`, `daima`.
  /// A word matches what is typed when it starts with it.
  keywords?: string[]
}

/// What is typed after the trigger and what it is matched against: lower
/// case, without spaces or the `'` an input method puts between syllables.
export function normalizeFilter(text: string) {
  return text.toLowerCase().replace(/[\s']+/g, '')
}

/// Whether an item is one of those that `filter` (typed after the trigger) asks for.
export function matchesFilter(item: SlashMenuItem, filter: string) {
  const wanted = normalizeFilter(filter)
  if (!wanted) return true
  return (
    normalizeFilter(item.label).includes(wanted) ||
    (item.keywords ?? []).some((word) =>
      normalizeFilter(word).startsWith(wanted)
    )
  )
}
