import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

/**
 * Light or dark, chosen with the header toggle and remembered in localStorage.
 * index.html applies the saved choice before the app loads, so this store starts from the page.
 */
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  watch(theme, (value) => {
    if (value === 'dark') {
      document.documentElement.dataset.theme = 'dark'
    } else {
      delete document.documentElement.dataset.theme
    }
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage blocked (private window): the choice lasts for this page only.
    }
  })

  return { theme, toggle }
})
