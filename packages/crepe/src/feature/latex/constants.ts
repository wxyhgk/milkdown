export const mathInlineId = 'math_inline'

export const toggleLatexCommandName = 'ToggleLatex'

/// The `fence` attr of a LaTeX code block written as `$$ … $$`, not as a fence.
export const MATH_BLOCK_FENCE = '$$'

/// The attrs of a new block of math.
export const mathBlockAttrs = { language: 'LaTeX', fence: MATH_BLOCK_FENCE }
