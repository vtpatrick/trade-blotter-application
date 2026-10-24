import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from '../theme'

describe('theme store', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to light', () => {
    expect(useThemeStore().theme).toBe('light')
  })

  it('starts from the theme index.html applied', () => {
    document.documentElement.dataset.theme = 'dark'

    expect(useThemeStore().theme).toBe('dark')
  })

  it('toggles the page theme and remembers the choice', async () => {
    const store = useThemeStore()

    store.toggle()
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    store.toggle()
    await nextTick()
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
