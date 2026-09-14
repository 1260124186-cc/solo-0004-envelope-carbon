import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Assembly, Layer } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Compliance, ComplianceRule } from '../compliance/types'
import type { EnvelopeData } from '../persistence/types'
import { createAssembly, createLayer, duplicateAssembly, moveLayer } from '../assemblies/factory'
import { requireEditable, validateAssembly } from '../assemblies/validation'
import { validateMaterial } from '../materials/validation'
import { calculate } from '../carbon/engine'
import { evaluateCompliance } from '../compliance/engine'
import { validateComplianceRule } from '../compliance/validation'
import { createDocument } from '../documents/create'
import { commitData, readData } from '../persistence/repository'
import { persistenceKey } from '../persistence/types'
import { clone, newId, now } from '../shared/identity'

export type WorkspaceTab = 'design' | 'compare' | 'documents' | 'materials' | 'rules'

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
  const findings = computed(() => {
    if (!draft.value) return []
    const issues = validateAssembly(draft.value, data.value?.materials ?? [])
    if (
      draft.value.ruleId &&
      !(data.value?.rules ?? []).some((rule) => rule.id === draft.value!.ruleId)
    ) {
      issues.push({
        path: 'ruleId',
        text: '所选达标规则不存在，请改用其它规则或切回构造自带目标。',
      })
    }
    return issues
  })
  const result = computed(() => {
    if (!draft.value || !data.value || findings.value.length) return null
    return calculate(draft.value, data.value.materials)
  })
  const selectedRule = computed<ComplianceRule | null>(
    () => data.value?.rules.find((rule) => rule.id === draft.value?.ruleId) ?? null,
  )
  const compliance = computed<Compliance | null>(() => {
    if (!draft.value || !result.value) return null
    return evaluateCompliance(draft.value, result.value, selectedRule.value)
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

  async function act(change: (next: EnvelopeData) => void, text: string): Promise<boolean> {
    if (!data.value || busy.value || fatal.value) return false
    clearFeedback()
    busy.value = true
    try {
      data.value = await commitData(data.value.stamp, change)
      externalChange.value = false
      notice.value = text
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '操作未完成，请重试。'
      return false
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
      // 定稿必须引用启用中的规则；停用规则的判定依据仍由历史计算书快照保留。
      const rule = assembly.ruleId
        ? (next.rules.find((item) => item.id === assembly.ruleId) ?? null)
        : null
      if (assembly.ruleId && (!rule || !rule.active)) {
        throw new Error('所选达标规则已停用，请改选启用中的规则或切回构造自带目标后再定稿。')
      }
      const document = createDocument(assembly, next.materials, rule)
      next.documents.push(document)
      assembly.state = 'finalized'
      assembly.updatedAt = now()
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
    return act((next) => {
      if (next.materials.length >= 500) throw new Error('最多保存 500 种材料。')
      if (next.materials.some((material) => material.name.trim() === candidate.name.trim())) {
        throw new Error('材料名称已存在，请使用可区分的名称。')
      }
      candidate.name = candidate.name.trim()
      next.materials.push(candidate)
    }, '自定义材料已保存，可在构造中选用。')
  }

  async function alignAlternative() {
    if (dirty.value) {
      error.value = '请先保存当前构造，避免口径调整覆盖编辑内容。'
      return
    }
    const saved = await act((next) => {
      const a = next.assemblies.find((item) => item.id === baselineId.value)
      const b = next.assemblies.find((item) => item.id === alternativeId.value)
      if (!a || !b || a.id === b.id) throw new Error('请选择两个不同的构造。')
      requireEditable(b)
      b.area = a.area
      b.years = a.years
      b.surface = a.surface
      b.revision += 1
      b.updatedAt = now()
    }, '替代构造已按基准统一部位、面积和年限。')
    if (saved && draft.value) {
      draft.value = clone(data.value!.assemblies.find((item) => item.id === draft.value!.id)!)
    }
  }

  async function saveRule(draftRule: {
    id?: string
    name: string
    description: string
    conditions: ComplianceRule['conditions']
  }): Promise<boolean> {
    const candidate: ComplianceRule = {
      id: draftRule.id || newId('compliance-rule'),
      name: draftRule.name.trim(),
      description: draftRule.description,
      conditions: clone(draftRule.conditions),
      active: true,
      builtIn: false,
      createdAt: now(),
      updatedAt: now(),
    }
    const issues = validateComplianceRule(candidate)
    if (issues.length) {
      error.value = issues[0]
      return false
    }
    return act(
      (next) => {
        if (next.rules.length >= 100) throw new Error('最多保存 100 条达标规则。')
        if (
          next.rules.some((rule) => rule.id !== candidate.id && rule.name.trim() === candidate.name)
        ) {
          throw new Error('规则名称已存在，请使用可区分的名称。')
        }
        const index = next.rules.findIndex((rule) => rule.id === candidate.id)
        if (index >= 0) {
          const existing = next.rules[index]
          if (existing.builtIn) throw new Error('内置示例规则不可修改，可复制后另存为自定义规则。')
          // 只更新名称、说明与条件；启停状态与创建时间保持不变。
          next.rules[index] = {
            ...existing,
            name: candidate.name,
            description: candidate.description,
            conditions: candidate.conditions,
            updatedAt: candidate.updatedAt,
          }
        } else {
          next.rules.push(candidate)
        }
      },
      draftRule.id
        ? '达标规则已修改，历史计算书的判定依据保持不变。'
        : '达标规则已保存，可在构造中选用。',
    )
  }

  async function setRuleActive(id: string, active: boolean): Promise<boolean> {
    return act(
      (next) => {
        const rule = next.rules.find((item) => item.id === id)
        if (!rule) throw new Error('达标规则不存在。')
        if (rule.builtIn) throw new Error('内置示例规则不可停用。')
        rule.active = active
        rule.updatedAt = now()
      },
      active ? '达标规则已重新启用。' : '达标规则已停用，历史计算书仍保留其判定依据。',
    )
  }

  function ruleUsageCount(id: string): number {
    return data.value?.assemblies.filter((assembly) => assembly.ruleId === id).length ?? 0
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
    selectedRule,
    compliance,
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
    alignAlternative,
    saveRule,
    setRuleActive,
    ruleUsageCount,
  }
}
