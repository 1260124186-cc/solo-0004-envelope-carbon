import { shallowRef } from 'vue'

/**
 * 统一错误反馈通道：只承载通知文案与忙碌状态，不包含任何业务判断。
 * 成功、失败、致命错误三类反馈彼此独立，clear 仅清空内联的成功/失败提示，
 * 跨标签页警示（externalChange）与致命面板（fatal）由各自的入口显式清除。
 */
export function useFeedback() {
  const notice = shallowRef('')
  const error = shallowRef('')
  const busy = shallowRef(false)
  const externalChange = shallowRef(false)
  const fatal = shallowRef('')

  function clear() {
    notice.value = ''
    error.value = ''
  }

  function succeed(text: string) {
    notice.value = text
  }

  function fail(text: string) {
    error.value = text
  }

  function failFrom(cause: unknown, fallback: string) {
    fail(cause instanceof Error ? cause.message : fallback)
  }

  function markExternalChange() {
    externalChange.value = true
  }

  function resetExternalChange() {
    externalChange.value = false
  }

  function markFatal(text: string) {
    fatal.value = text
  }

  function clearFatal() {
    fatal.value = ''
  }

  return {
    notice,
    error,
    busy,
    externalChange,
    fatal,
    clear,
    succeed,
    fail,
    failFrom,
    markExternalChange,
    resetExternalChange,
    clearFatal,
    markFatal,
  }
}

export type FeedbackChannel = ReturnType<typeof useFeedback>
