import { describe, expect, test } from 'vitest'

import { getGroups } from './menu/config'
import { matchesFilter } from './menu/utils'

describe('matchesFilter', () => {
  const item = { label: '代码块', icon: '', keywords: ['code', 'daima', 'dm'] }

  test.each([
    ['', true],
    ['代码', true],
    ['码块', true],
    ['Code', true],
    ['da', true],
    ['dai ma', true],
    ["dai'ma", true],
    ['dm', true],
    // A keyword matches from its start only.
    ['ode', false],
    ['table', false],
  ])('%j → %s', (filter, expected) => {
    expect(matchesFilter(item, filter)).toBe(expected)
  })

  test('without keywords, only the label', () => {
    expect(matchesFilter({ label: 'Table', icon: '' }, 'tab')).toBe(true)
    expect(matchesFilter({ label: 'Table', icon: '' }, 'grid')).toBe(false)
  })
})

describe('getGroups', () => {
  test('finds an item by its keywords', () => {
    const { groups, size } = getGroups('callout', {
      textGroup: null,
      listGroup: null,
      advancedGroup: null,
      buildMenu: (builder) => {
        builder
          .addGroup('blocks', 'Blocks')
          .addItem('callout', { label: '提示块', icon: '', keywords: ['callout'] })
          .addItem('toggle', { label: '折叠块', icon: '', keywords: ['toggle'] })
      },
    })
    expect(size).toBe(1)
    expect(groups[0]!.items.map((item) => item.key)).toEqual(['callout'])
  })
})
