import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { createDocument } from '../documents/create'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { clone, newId, now } from '../shared/identity'
import { alignedAssembly } from '../comparison/compare'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials'

export function useWorkspace() {
  const data = shallowRef<EnvelopeData | null>(null)
  const draft = ref<Assembly | null>(null)
  const tab = shallowRef<WorkspaceTab>('design')
  const notice = shallowRef('')
  const error = shallowRef('')
  const busy = shallowRef(false)
  const externalChange = shallowRef(false)
  const fatal = shallowRef('')
  const baselineId = shallowRef('')
  const alternativeId = shallowRef('')
  const persisted = computed(() =>
    data.value?.assemblies.find((item) => item.id === draft.value?.id),
  )
  const dirty = computed(() =>
    Boolean(draft.value && JSON.stringify(draft.value) !== JSON.stringify(persisted.value)),
  )
  const editable = computed(() => draft.value?.state === 'editing')
  const findings = computed(() =>
    draft.value ? validateAssembly(draft.value, data.value?.materials ?? []) : [],
  )
  const result = computed(() => {
    if (!draft.value || !data.value || findings.value.length) return null
    return calculate(draft.value, data.value.materials)
  })
  const selectedDocuments = computed(
    () =>
      data.value?.documents
        .filter((document) => document.assemblyId === draft.value?.id)
        .slice()
        .reverse() ?? [],
  )

  function clearFeedback() {
    notice.value = ''
    error.value = ''
  }

  function mayDiscard(): boolean {
    return !dirty.value || window.confirm('当前构造有未保存的修改，是否放弃这些修改？')
  }

  function load(initial = false) {
    if (!initial && !mayDiscard()) return
    try {
      const next = readData()
      const selectedId = draft.value?.id
      data.value = next
      draft.value = clone(
        next.assemblies.find((item) => item.id === selectedId) ?? next.assemblies[0] ?? null,
      )
      baselineId.value = next.assemblies[0]?.id ?? ''
      alternativeId.value = next.assemblies[1]?.id ?? ''
      fatal.value = ''
      externalChange.value = false
      clearFeedback()
      if (!initial) notice.value = '已重新加载保存版本。'
    } catch (cause) {
      fatal.value = cause instanceof Error ? cause.message : '无法读取浏览器存储。'
    }
  }

  function select(id: string) {
    if (busy.value || !mayDiscard()) return
    const selected = data.value?.assemblies.find((item) => item.id === id)
    if (!selected) return
    draft.value = clone(selected)
    clearFeedback()
    tab.value = 'design'
  }

  function create() {
    if (busy.value || !mayDiscard()) return
    draft.value = createAssembly()
    clearFeedback()
    tab.value = 'design'
  }

  function duplicate() {
    if (busy.value || !draft.value) return
    if (dirty.value) {
      error.value = '请先保存当前构造，再复制替代方案。'
      return
    }
    baselineId.value = draft.value.id
    draft.value = duplicateAssembly(draft.value)
    alternativeId.value = draft.value.id
    tab.value = 'design'
    clearFeedback()
    notice.value = '已创建替代构造草稿，修改后保存即可比较。'
  }

  function update(patch: Partial<Assembly>) {
    if (!draft.value || !editable.value || busy.value) return
    draft.value = { ...draft.value, ...patch }
    clearFeedback()
  }

  function addMaterial(material: Material) {
    if (!draft.value || !editable.value || busy.value) return
    if (draft.value.layers.length >= 20) {
      error.value = '单个构造最多包含 20 层。'
      return
    }
    update({ layers: [...draft.value.layers, createLayer(material)] })
  }

  function updateLayer(id: string, patch: Partial<Layer>) {
    if (!draft.value) return
    update({
      layers: draft.value.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    })
  }

  function removeLayer(id: string) {
    if (!draft.value) return
    update({ layers: draft.value.layers.filter((layer) => layer.id !== id) })
  }

  function move(id: string, direction: -1 | 1) {
    if (!draft.value) return
    update({ layers: moveLayer(draft.value.layers, id, direction) })
  }

  async function act<T>(change: (next: EnvelopeData) => T, text: string): Promise<T | null> {
    if (!data.value || busy.value || fatal.value) return null
    clearFeedback()
    busy.value = true
    try {
      let outcome: T
      data.value = await commitData(data.value.stamp, (next) => {
        outcome = change(next)
      })
      externalChange.value = false
      notice.value = text
      return outcome!
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。'
      return null
    } finally {
      busy.value = false
    }
  }

  async function save() {
    if (!draft.value || !data.value || !editable.value) return
    if (findings.value.length) {
      error.value = findings.value[0].text
      return
    }
    const candidate = clone(draft.value)
    candidate.name = candidate.name.trim()
    candidate.revision += 1
    candidate.updatedAt = now()
    const saved = await act((next) => {
      const index = next.assemblies.findIndex((item) => item.id === candidate.id)
      if (index >= 0) {
        requireEditable(next.assemblies[index])
        next.assemblies[index] = candidate
      } else {
        if (next.assemblies.length >= 200) throw new Error('最多保存 200 个构造。')
        next.assemblies.push(candidate)
      }
      return true
    }, '构造已保存。')
    if (saved) draft.value = clone(candidate)
  }

  async function finalize() {
    if (!draft.value || !persisted.value || dirty.value) {
      error.value = '请先保存当前构造，再生成定稿。'
      return
    }
    const id = draft.value.id
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly) throw new Error('构造不存在。')
      if (next.documents.length >= 1000) throw new Error('计算书已达到 1,000 份容量上限。')
      const document = createDocument(assembly, next.materials)
      next.documents.push(document)
      assembly.state = 'finalized'
      assembly.updatedAt = now()
      return true
    }, '计算书已定稿，构造现为只读。')
    if (saved) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      tab.value = 'documents'
    }
  }

  async function reopen() {
    if (!draft.value) return
    const id = draft.value.id
    const saved = await act((next) => {
      const assembly = next.assemblies.find((item) => item.id === id)
      if (!assembly || assembly.state !== 'finalized')
        throw new Error('只有已定稿构造可以重新编辑。')
      assembly.state = 'editing'
      assembly.revision += 1
      assembly.updatedAt = now()
      return true
    }, '已重新开启编辑，历史计算书保持不变。')
    if (saved) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === id)!)
      tab.value = 'design'
    }
  }

  async function addCustomMaterial(input: Material): Promise<boolean> {
    const candidate = clone({ ...input, id: newId('material'), custom: true })
    const errors = validateMaterial(candidate)
    if (errors.length) {
      error.value = errors[0]
      return false
    }
    const saved = await act((next) => {
      if (next.materials.length >= 500) throw new Error('最多保存 500 种材料。')
      if (next.materials.some((material) => material.name.trim() === candidate.name.trim())) {
        throw new Error('材料名称已存在，请使用可区分的名称。')
      }
      candidate.name = candidate.name.trim()
      next.materials.push(candidate)
      return true
    }, '自定义材料已保存，可在构造中选用。')
    return saved !== null
  }

  /**
   * 把一个或多个编辑中构造一次性对齐到当前基准的部位、面积与年限。
   * 整批在同一互斥锁与修订核对内提交：任一构造不可对齐即整体中止，绝不部分写入；
   * 不为批量放宽单个构造的校验，也不覆盖其他标签页已保存的结果。
   */
  async function alignAssemblies(targetIds: string[]): Promise<boolean> {
    if (busy.value || fatal.value) return false
    const ids = Array.from(new Set(targetIds))
    if (!ids.length) {
      error.value = '请先勾选需要对齐的构造。'
      return false
    }
    // 批量（多于一个）不允许覆盖编辑区占用的构造；单个对齐沿用编辑区保护规则，
    // 但要求当前草稿已保存，避免把未保存修改静默冲掉。
    if (ids.length > 1 && ids.some((id) => id === draft.value?.id)) {
      error.value =
        '「' + draft.value!.name + '」正在编辑区占用，请先在构造编辑中保存或改选其他构造。'
      return false
    }
    if (ids.length === 1 && ids[0] === draft.value?.id && dirty.value) {
      error.value = '请先保存当前构造，避免口径调整覆盖编辑内容。'
      return false
    }
    const changedIds = await act((next) => {
      const baseline = next.assemblies.find((item) => item.id === baselineId.value)
      if (!baseline) throw new Error('请先选择基准构造。')
      const changed: string[] = []
      for (const id of ids) {
        if (id === baseline.id) continue
        const target = next.assemblies.find((item) => item.id === id)
        if (!target) throw new Error('待对齐构造不存在，请刷新列表后重试。')
        requireEditable(target)
        const aligned = alignedAssembly(baseline, target)
        if (validateAssembly(aligned, next.materials).length) {
          throw new Error(
            `「${target.name}」对齐后未通过构造校验，请先修正再统一口径；本次未保存任何改动。`,
          )
        }
        if (
          target.surface !== baseline.surface ||
          target.area !== baseline.area ||
          target.years !== baseline.years
        ) {
          target.surface = aligned.surface
          target.area = aligned.area
          target.years = aligned.years
          target.revision += 1
          target.updatedAt = now()
          changed.push(id)
        }
      }
      if (!changed.length) throw new Error('所选构造与基准口径已一致，无需保存。')
      return changed
    }, '')
    if (changedIds) {
      notice.value =
        changedIds.length === 1
          ? '替代构造已按基准统一部位、面积和年限。'
          : `已将 ${changedIds.length} 个构造一次性对齐到基准口径。`
      if (draft.value && changedIds.includes(draft.value.id)) {
        draft.value = clone(data.value!.assemblies.find((item) => item.id === draft.value!.id)!)
      }
      return true
    }
    return false
  }

  function onStorage(event: StorageEvent) {
    if (
      event.storageArea === localStorage &&
      (event.key === persistenceKey || event.key === null)
    ) {
      externalChange.value = true
    }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) event.preventDefault()
  }

  onMounted(() => {
    load(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', beforeUnload)
  })

  return {
    data,
    draft,
    tab,
    notice,
    error,
    fatal,
    busy,
    externalChange,
    dirty,
    editable,
    findings,
    result,
    selectedDocuments,
    baselineId,
    alternativeId,
    load,
    select,
    create,
    duplicate,
    update,
    addMaterial,
    updateLayer,
    removeLayer,
    move,
    save,
    finalize,
    reopen,
    addCustomMaterial,
    alignAssemblies,
  }
}
