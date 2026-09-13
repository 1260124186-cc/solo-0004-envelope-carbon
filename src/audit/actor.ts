import { newId } from '../shared/identity'

// 审计操作者由两部分组成：
// browser 标识持久化在独立键上，同一浏览器跨标签页相同；
// session 后缀每个标签页（会话）生成一次，便于区分并发标签页。
// 二者都只用于区分操作者，不收集任何个人信息。

const actorKey = 'solo-0004-envelope-carbon:actor:v1'

function short(value: string): string {
  return value.slice(-6)
}

function browserId(): string {
  try {
    const existing = localStorage.getItem(actorKey)
    if (existing && /^browser-[0-9a-f-]{12,}$/.test(existing)) return existing
    const generated = newId('browser')
    localStorage.setItem(actorKey, generated)
    return generated
  } catch {
    // 存储不可用时仍给出本会话可用的标识
    return newId('browser')
  }
}

let cached = ''

/**
 * 返回形如 a1b2c3#f4e5d6 的紧凑标识。
 * 同一标签页内结果稳定：存储成功落库与入档拒绝属于同一会话。
 */
export function currentActor(): string {
  if (cached) return cached
  const session = short(newId('tab'))
  try {
    cached = `${short(browserId())}#${session}`
  } catch {
    cached = session
  }
  return cached
}
