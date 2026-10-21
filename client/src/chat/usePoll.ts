import { useEffect, useRef } from 'react'

/**
 * Calls `fn` now and then every `intervalMs` after the previous call finishes,
 * so slow requests never overlap. Skips while the tab is hidden and runs again
 * as soon as it becomes visible. The signal is aborted on unmount.
 * `fn` should handle its own errors; a thrown error just waits for the next tick.
 */
export function usePoll(fn: (signal: AbortSignal) => Promise<void>, intervalMs: number) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false

    async function tick() {
      clearTimeout(timer)
      if (running || controller.signal.aborted) return
      running = true
      try {
        if (!document.hidden) await fnRef.current(controller.signal)
      } catch {
        // Next tick retries.
      } finally {
        running = false
      }
      if (!controller.signal.aborted) timer = setTimeout(tick, intervalMs)
    }

    function onVisible() {
      if (!document.hidden) void tick()
    }

    void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
}
