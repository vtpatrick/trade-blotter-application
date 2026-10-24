import { onScopeDispose, ref } from 'vue'
import { fetchBloombergAvailable } from '@/api/bloomberg'

/** Polls whether live Bloomberg prices are available on this desk (via DeskLink). */
export function useBloombergStatus(intervalMs = 30_000) {
  const available = ref<boolean | null>(null) // null until the first check answers

  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  async function check() {
    available.value = await fetchBloombergAvailable(controller.signal)
    if (!controller.signal.aborted) timer = setTimeout(check, intervalMs)
  }
  void check()

  onScopeDispose(() => {
    controller.abort()
    clearTimeout(timer)
  })

  return { available }
}
