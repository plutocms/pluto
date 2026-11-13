import type { Ref } from 'vue'
import { Extension } from '@tiptap/core'

const RENDER_INTERVAL = 120

function throttledRef<T>(initial: T): Ref<T> {
  let value = initial
  let last = 0
  let scheduled = false
  return customRef((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(next) {
      value = next
      if (scheduled) {
        return
      }
      scheduled = true
      const wait = Math.max(0, last + RENDER_INTERVAL - performance.now())
      const run = () => {
        scheduled = false
        last = performance.now()
        trigger()
      }
      if (wait === 0) {
        requestAnimationFrame(run)
      } else {
        setTimeout(run, wait)
      }
    },
  }))
}

/**
 * The Vue editor of Tiptap keeps its state in a ref (`reactiveState`) that starts a render of every
 * component that reads it (the toolbar, the bubble toolbar, the block handle) after each
 * transaction, so each key rendered every button of the toolbars again: fast typing, or a held
 * Backspace, made the page lag until it froze. This extension swaps that ref for one that keeps
 * the state at once (`editor.state` is always current) and renders at most every 120 ms. The
 * text itself is ProseMirror: it never waits.
 */
export const PlutoThrottledState = Extension.create({
  name: 'plutoThrottledState',

  onCreate() {
    const editor = this.editor as typeof this.editor & {
      reactiveState?: Ref<unknown>
    }
    const old = editor.reactiveState
    if (!old) {
      return
    }
    editor.reactiveState = throttledRef(editor.view.state)
    old.value = editor.view.state
  },
})
