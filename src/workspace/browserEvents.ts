import { onMounted, onUnmounted } from 'vue'

/**
 * 浏览器事件接线：只负责把 window 事件转成回调，并在卸载时释放监听，
 * 事件触发后的状态判断与提示由调用方提供的回调完成。
 */
export function useBrowserEvents(options: {
  onStorage: (event: StorageEvent) => void
  shouldWarnBeforeUnload: () => boolean
}) {
  function beforeUnload(event: BeforeUnloadEvent): void {
    if (options.shouldWarnBeforeUnload()) event.preventDefault()
  }

  onMounted(() => {
    window.addEventListener('storage', options.onStorage)
    window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', options.onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
  })
}
