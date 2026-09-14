<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { AlignmentPreview } from './compare'
import { caliberChanges, comparableReasons, compare, previewAlignment } from './compare'
import ComparisonResult from './ComparisonResult.vue'
import AlignmentPreviewPanel from './AlignmentPreview.vue'
import { surfaceLabels, stateLabels } from '../assemblies/types'

const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  busy: boolean
  dirty: boolean
  draftId: string
  alignAssemblies: (ids: string[]) => Promise<boolean>
}>()
const baselineId = defineModel<string>('baselineId', { required: true })
const alternativeId = defineModel<string>('alternativeId', { required: true })
const emit = defineEmits<{ design: [] }>()

const checkedIds = ref<string[]>([])
const pairwiseArmed = ref(false)

const baseline = computed(() => props.assemblies.find((item) => item.id === baselineId.value))
const alternative = computed(() => props.assemblies.find((item) => item.id === alternativeId.value))

// 基准或替代变化时，收起确认态；勾选列表变化后清理已失效的勾选项。
watch([baselineId, alternativeId], () => {
  pairwiseArmed.value = false
})
watch(
  () => props.assemblies,
  (items) => {
    const valid = new Set(items.map((item) => item.id))
    checkedIds.value = checkedIds.value.filter((id) => valid.has(id) && id !== baselineId.value)
  },
)
watch(baselineId, (id) => {
  checkedIds.value = checkedIds.value.filter((candidate) => candidate !== id)
})

const evaluation = computed(() => {
  if (!baseline.value || !alternative.value)
    return { result: null, errors: ['请选择基准构造和替代构造。'] }
  const errors = comparableReasons(baseline.value, alternative.value)
  if (errors.length) return { result: null, errors }
  try {
    return { result: compare(baseline.value, alternative.value, props.materials), errors: [] }
  } catch (error) {
    return {
      result: null,
      errors: [error instanceof Error ? error.message : '无法比较这两个构造。'],
    }
  }
})

const mismatched = computed(
  () =>
    Boolean(baseline.value && alternative.value) &&
    baseline.value!.id !== alternative.value!.id &&
    caliberChanges(baseline.value!, alternative.value!).some((change) => change.changed),
)

const pairwisePreview = computed<AlignmentPreview | null>(() =>
  baseline.value && alternative.value && baseline.value.id !== alternative.value.id
    ? previewAlignment(baseline.value, alternative.value, props.materials)
    : null,
)

const alternativeOccupied = computed(() => alternative.value?.id === props.draftId)

const pairwiseBlockedReason = computed(() => {
  if (!alternative.value || !baseline.value || alternative.value.id === baseline.value.id)
    return '请选择两个不同的构造。'
  if (alternative.value.state === 'finalized') return '该替代构造已定稿，需先重新开启编辑。'
  if (alternativeOccupied.value && props.dirty)
    return '该构造正在编辑区且有未保存修改，请先保存或放弃编辑内容。'
  if (pairwisePreview.value?.errors.length) return pairwisePreview.value.errors[0]
  return ''
})

type BlockKind = 'ready' | 'aligned' | 'finalized' | 'occupied' | 'invalid'

interface BatchRow {
  assembly: Assembly
  changes: ReturnType<typeof caliberChanges>
  preview: AlignmentPreview
  checked: boolean
  disabled: boolean
  kind: BlockKind
  reason: string
}

const batchRows = computed<BatchRow[]>(() => {
  if (!baseline.value) return []
  return props.assemblies
    .filter((item) => item.id !== baseline.value!.id)
    .map((assembly) => {
      const changes = caliberChanges(baseline.value!, assembly)
      const preview = previewAlignment(baseline.value!, assembly, props.materials)
      const needsAlign = changes.some((change) => change.changed)
      let kind: BlockKind = 'ready'
      let reason = '可对齐'
      if (assembly.id === props.draftId) {
        kind = 'occupied'
        reason = props.dirty ? '正在编辑区占用且有未保存修改' : '正在编辑区占用，请先改选其他构造'
      } else if (assembly.state === 'finalized') {
        kind = 'finalized'
        reason = '已定稿，需先重新开启编辑'
      } else if (needsAlign && preview.errors.length) {
        kind = 'invalid'
        reason = `对齐后校验不通过：${preview.errors[0]}`
      } else if (!needsAlign) {
        kind = 'aligned'
        reason = '口径已与基准一致，无需修改'
      }
      return {
        assembly,
        changes,
        preview,
        checked: checkedIds.value.includes(assembly.id),
        disabled: kind !== 'ready',
        kind,
        reason,
      }
    })
})

const selectableRows = computed(() => batchRows.value.filter((row) => !row.disabled))
const allChecked = computed(
  () => selectableRows.value.length > 0 && selectableRows.value.every((row) => row.checked),
)
const checkedRows = computed(() => batchRows.value.filter((row) => row.checked))

function toggleRow(id: string, checked: boolean) {
  if (checked) {
    if (!checkedIds.value.includes(id)) checkedIds.value = [...checkedIds.value, id]
  } else {
    checkedIds.value = checkedIds.value.filter((candidate) => candidate !== id)
  }
}

function toggleAll(checked: boolean) {
  checkedIds.value = checked ? selectableRows.value.map((row) => row.assembly.id) : []
}

const batchConfirmBlocked = computed(() => {
  if (!checkedRows.value.length) return '请勾选一个或多个编辑中构造。'
  const blocked = checkedRows.value.find((row) => row.kind !== 'ready')
  if (blocked) return `「${blocked.assembly.name}」${blocked.reason}，无法整批保存。`
  return ''
})

async function confirmBatch() {
  if (batchConfirmBlocked.value || props.busy) return
  const ids = checkedRows.value.map((row) => row.assembly.id)
  const ok = await props.alignAssemblies(ids)
  if (ok) checkedIds.value = []
}

async function confirmPairwise() {
  if (!alternative.value || pairwiseBlockedReason.value || props.busy) return
  pairwiseArmed.value = false
  await props.alignAssemblies([alternative.value.id])
}
</script>

<template>
  <section class="panel comparison-workspace">
    <span class="eyebrow">替代研究</span>
    <h1>先看清口径差异，再决定如何统一。</h1>
    <p class="section-intro">
      比较使用已保存的构造。基准与替代在部位、面积、年限上的差异会逐项列出；统一口径前可先预览结果变化，确认后才保存。
    </p>
    <div
      v-if="assemblies.length < 2"
      class="empty-state"
    >
      <h2>还需要一个替代构造</h2>
      <p>返回构造编辑，使用「复制为替代方案」，修改并保存后即可比较。</p>
      <button
        class="button primary"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <p
        v-if="dirty"
        class="inline-warning"
      >
        编辑区仍有未保存修改，以下结果来自最近保存版本。
      </p>
      <div class="comparison-selectors">
        <label
          >基准构造
          <select
            v-model="baselineId"
            :disabled="busy"
          >
            <option
              value=""
              disabled
            >
              选择基准
            </option>
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
        <span
          class="comparison-arrow"
          aria-hidden="true"
          >→</span
        >
        <label
          >替代构造
          <select
            v-model="alternativeId"
            :disabled="busy"
          >
            <option
              value=""
              disabled
            >
              选择替代
            </option>
            <option
              v-for="item in assemblies"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div
        v-if="evaluation.errors.length"
        class="empty-state"
      >
        <p
          v-for="error in evaluation.errors"
          :key="error"
        >
          {{ error }}
        </p>
      </div>
      <ComparisonResult
        v-if="evaluation.result && baseline && alternative"
        :result="evaluation.result"
        :baseline-name="baseline.name"
        :alternative-name="alternative.name"
      />

      <div
        v-if="mismatched && pairwisePreview && baseline && alternative"
        class="pairwise-align"
        data-check="pairwise-align"
      >
        <AlignmentPreviewPanel :preview="pairwisePreview" />
        <p
          v-if="alternativeOccupied && !dirty && alternative.state === 'editing'"
          class="pairwise-note"
        >
          该构造正在编辑区占用；统一保存后编辑区会刷新为对齐后的版本。
        </p>
        <div class="pairwise-actions">
          <template v-if="!pairwiseArmed">
            <button
              class="button primary"
              :disabled="busy || Boolean(pairwiseBlockedReason)"
              @click="pairwiseArmed = true"
            >
              将此替代构造对齐到基准并保存
            </button>
            <button
              class="button"
              @click="emit('design')"
            >
              手动在编辑区调整
            </button>
          </template>
          <template v-else>
            <button
              class="button primary"
              :disabled="busy"
              data-check="pairwise-confirm"
              @click="confirmPairwise"
            >
              确认保存对齐结果
            </button>
            <button
              class="button"
              :disabled="busy"
              @click="pairwiseArmed = false"
            >
              取消，不做修改
            </button>
          </template>
        </div>
        <p
          v-if="pairwiseBlockedReason && !pairwiseArmed"
          class="blocked-note"
          data-check="pairwise-blocked"
        >
          无法对齐：{{ pairwiseBlockedReason }}
        </p>
      </div>

      <section
        v-if="baseline"
        class="batch-align"
        aria-labelledby="batch-align-title"
      >
        <div class="batch-heading">
          <div>
            <span class="eyebrow">批量统一口径</span>
            <h2 id="batch-align-title">
              一次选择多个编辑中构造，对齐到基准「{{ baseline.name }}」
            </h2>
          </div>
        </div>
        <p class="section-intro">
          勾选的构造会先逐项预览，再一次性提交到同一修订与互斥保护内；任一构造被阻断则整批不保存，取消则完全不改。
        </p>
        <div class="table-scroll">
          <table>
            <caption class="sr-only">
              可对齐构造列表与阻断说明
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span class="batch-check-all">
                    <input
                      type="checkbox"
                      :checked="allChecked"
                      :disabled="busy || selectableRows.length === 0"
                      aria-label="全选所有可对齐构造"
                      @change="toggleAll(($event.target as HTMLInputElement).checked)"
                    />
                    选择
                  </span>
                </th>
                <th scope="col">构造</th>
                <th scope="col">状态</th>
                <th scope="col">口径差异</th>
                <th scope="col">对齐后结果预览</th>
                <th scope="col">阻断 / 说明</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in batchRows"
                :key="row.assembly.id"
                :class="['batch-row', `kind-${row.kind}`, { 'row-checked': row.checked }]"
              >
                <td>
                  <input
                    type="checkbox"
                    :checked="row.checked"
                    :disabled="busy || row.disabled"
                    :aria-label="`选择构造 ${row.assembly.name}`"
                    :data-check="`batch-check-${row.assembly.id}`"
                    @change="
                      toggleRow(row.assembly.id, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </td>
                <th
                  scope="row"
                  class="batch-name"
                >
                  {{ row.assembly.name }}
                </th>
                <td class="batch-state">
                  {{ stateLabels[row.assembly.state] }} ·
                  {{ surfaceLabels[row.assembly.surface] }}
                </td>
                <td>
                  <ul class="row-changes">
                    <li
                      v-for="change in row.changes"
                      :key="change.key"
                      :class="{ changed: change.changed }"
                      :data-check="`batch-caliber-${row.assembly.id}-${change.key}`"
                    >
                      <span class="muted">{{ change.label }}：</span>
                      <template v-if="change.changed">
                        <span class="strike">{{ change.current }}</span>
                        <span aria-hidden="true">→</span>
                        <strong>{{ change.baseline }}</strong>
                      </template>
                      <template v-else>一致</template>
                    </li>
                  </ul>
                </td>
                <td>
                  <AlignmentPreviewPanel
                    :preview="row.preview"
                    compact
                  />
                </td>
                <td>
                  <span
                    class="reason"
                    :class="`reason-${row.kind}`"
                    :data-check="`batch-blocked-${row.assembly.id}`"
                  >
                    {{ row.reason }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="checkedRows.length"
          class="batch-preview"
          data-check="batch-preview"
        >
          <h3>已选 {{ checkedRows.length }} 个构造的对齐预览</h3>
          <div
            v-for="row in checkedRows"
            :key="row.assembly.id"
            class="batch-preview-item"
          >
            <h4>{{ row.assembly.name }}</h4>
            <AlignmentPreviewPanel :preview="row.preview" />
          </div>
        </div>

        <div class="batch-actions">
          <button
            class="button"
            :disabled="busy || checkedRows.length === 0"
            @click="checkedIds = []"
          >
            取消选择（不做修改）
          </button>
          <button
            class="button primary"
            :disabled="busy || Boolean(batchConfirmBlocked)"
            data-check="batch-confirm"
            @click="confirmBatch"
          >
            一次性保存 {{ checkedRows.length }} 个构造的对齐结果
          </button>
        </div>
        <p
          v-if="batchConfirmBlocked"
          class="blocked-note"
          data-check="batch-blocked-summary"
        >
          {{ batchConfirmBlocked }}
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.comparison-workspace {
  max-width: 1200px;
  margin: 0 auto;
}
.comparison-selectors {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  align-items: end;
  gap: 20px;
  margin: 28px 0;
}
.comparison-arrow {
  padding-bottom: 12px;
  text-align: center;
  color: var(--green);
}
.pairwise-align {
  margin-top: 24px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.pairwise-actions,
.batch-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.pairwise-note {
  font-size: 12px;
  color: var(--muted);
  margin: 8px 0 0;
}
.blocked-note {
  color: #922f20;
  background: #fff0eb;
  border: 1px solid #eacac0;
  border-radius: 4px;
  padding: 10px 14px;
  font-size: 12px;
  margin: 12px 0 0;
}
.batch-align {
  margin-top: 36px;
  border-top: 2px solid var(--line);
  padding-top: 24px;
}
.batch-align table {
  min-width: 820px;
}
.batch-align .table-scroll {
  border: 1px solid var(--line);
  border-radius: 6px;
  margin-top: 8px;
}
.batch-heading h2 {
  font-size: 16px;
  margin-top: 6px;
}
.batch-check-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.batch-check-all input,
tbody input[type='checkbox'] {
  width: auto;
}
.batch-name {
  font-weight: 600;
}
.batch-state,
.batch-row td {
  white-space: normal;
}
.batch-row.row-checked {
  background: #f1f6ec;
}
.batch-row.kind-finalized,
.batch-row.kind-occupied,
.batch-row.kind-invalid {
  background: #faf4f1;
}
.batch-row.kind-aligned {
  color: var(--muted);
}
.reason {
  font-size: 11px;
}
.reason-ready {
  color: var(--green);
}
.reason-aligned {
  color: var(--muted);
}
.reason-finalized,
.reason-occupied,
.reason-invalid {
  color: #922f20;
}
.row-changes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 3px;
  font-size: 11px;
}
.row-changes .strike {
  color: #9c6b57;
  text-decoration: line-through;
  margin-right: 4px;
}
.row-changes .changed strong {
  color: var(--green);
  margin-left: 4px;
}
.batch-preview {
  margin-top: 20px;
  padding: 18px 20px;
  background: #f3f7f1;
  border: 1px solid #cfd8ca;
  border-radius: 6px;
}
.batch-preview h3 {
  font-size: 14px;
  margin: 0 0 12px;
}
.batch-preview-item {
  border-top: 1px solid #d4ddce;
  padding-top: 12px;
  margin-top: 12px;
}
.batch-preview-item:first-of-type {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}
.batch-preview-item h4 {
  font-size: 13px;
  margin: 0 0 6px;
}
.batch-actions {
  justify-content: flex-end;
}
@media (max-width: 650px) {
  .comparison-selectors {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .comparison-arrow {
    display: none;
  }
  .batch-actions {
    justify-content: stretch;
  }
  .batch-actions .button {
    flex: 1;
  }
}
</style>
