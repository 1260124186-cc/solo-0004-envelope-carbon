import type { Assembly } from './types'
import { clone } from '../shared/identity'

/** 同一输入身份连续两次输入的最大间隔；每次输入都会续期，停顿超过该时长才断成新步骤。 */
const COALESCE_WINDOW_MS = 1000
/** 历史只服务当前编辑，限制内存占用，不承担存档职责。 */
const HISTORY_LIMIT = 100

interface HistoryEntry {
  before: Assembly
  after: Assembly
  /** 非空时，同一来源且在时间窗内的连续修改合并为一步（如在同一输入框连续打字）。 */
  coalesce: string | null
  at: number
}

/**
 * 构造编辑的撤销/重做历史。
 * 边界为：打开构造（或新建/复制/重新开启编辑/重新加载）时建立基线，
 * 保存成功后以已保存版本重建基线，使撤销可回到“已保存且无未保存修改”的状态。
 */
export class EditHistory {
  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []

  /** 以当前构造作为新边界重建历史（切换构造、保存成功、重新开启编辑时调用）。 */
  reset(snapshot: Assembly): void {
    this.past = []
    this.future = []
    this.bottom = clone(snapshot)
  }

  constructor(private bottom: Assembly) {}

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  /**
   * 记录一次从 before 到 after 的编辑。
   * 新修改会清空失效的重做记录。
   * coalesce 是“层或基本字段”的稳定输入身份：同一身份的连续输入在时间窗内合并为一步，
   * 窗口按每次输入续期（滑动窗口），因此连续打字到停笔前始终是一步；
   * 不同层（即便字段同名）身份不同，必须各自成步。
   */
  record(
    before: Assembly,
    after: Assembly,
    coalesce: string | null = null,
    at: number = Date.now(),
  ): void {
    const previous = this.past[this.past.length - 1]
    if (
      coalesce &&
      previous &&
      previous.coalesce === coalesce &&
      at - previous.at <= COALESCE_WINDOW_MS
    ) {
      previous.after = clone(after)
      // 滑动窗口：以本次输入时间续期，连续输入到停笔前保持同一步。
      previous.at = at
    } else {
      this.past.push({ before: clone(before), after: clone(after), coalesce, at })
      if (this.past.length > HISTORY_LIMIT) {
        this.past.splice(0, this.past.length - HISTORY_LIMIT)
      }
    }
    this.future = []
  }

  /** 撤销一步，返回应显示的构造；没有可撤销步骤时返回 null。 */
  undo(current: Assembly): Assembly | null {
    const entry = this.past.pop()
    if (!entry) return null
    this.future.push({ ...entry, after: clone(current) })
    return clone(entry.before)
  }

  /** 重做一步，返回应显示的构造；没有可重做步骤时返回 null。 */
  redo(current: Assembly): Assembly | null {
    const entry = this.future.pop()
    if (!entry) return null
    this.past.push({ ...entry, before: clone(current) })
    return clone(entry.after)
  }

  /** 当前历史边界对应的构造（打开编辑或上次保存时的版本）。 */
  baseline(): Assembly {
    return clone(this.bottom)
  }
}
