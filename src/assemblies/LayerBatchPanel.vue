<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BatchTarget, LayerBatchPatch } from './types'
import type { Material } from '../materials/types'
import { inRange } from './validation'
import { number } from '../shared/format'
const props = defineProps<{
  targets: BatchTarget[]
  materials: Material[]
  disabled: boolean
}>()
const emit = defineEmits<{
  apply: [patch: LayerBatchPatch]
  cancel: []
}>()
const editLoss = ref(false)
const editLifespan = ref(false)
const lossText = ref<string | number>('')
const lifespanText = ref<string | number>('')
function shared(values: number[]): number | null {
  return values.length > 0 && values.every((value) => value === values[0]) ? values[0] : null
}
const commonLoss = computed(() => shared(props.targets.map((target) => target.layer.loss)))
const commonLifespan = computed(() => shared(props.targets.map((target) => target.layer.lifespan)))
watch(
  () =>
    props.targets
      .map((target) => `${target.layer.id}:${target.layer.loss}:${target.layer.lifespan}`)
      .join(','),
  () => {
    lossText.value = commonLoss.value === null ? '' : String(commonLoss.value)
    lifespanText.value = commonLifespan.value === null ? '' : String(commonLifespan.value)
  },
  { immediate: true },
)
function materialName(materialId: string): string {
  return props.materials.find((item) => item.id === materialId)?.name ?? '未知材料'
}
function parse(value: string | number): number {
  if (typeof value === 'number') return value
  return value.trim() === '' ? NaN : Number(value)
}
const issues = computed(() => {
  const list: string[] = []
  if (!editLoss.value && !editLifespan.value) list.push('请至少勾选一项要修改的字段。')
  if (editLoss.value && !inRange(parse(lossText.value), 0, 50)) {
    list.push('损耗率需在 0 至 50% 之间。')
  }
  const lifespan = parse(lifespanText.value)
  if (editLifespan.value && (!inRange(lifespan, 1, 150) || !Number.isInteger(lifespan))) {
    list.push('替换寿命需为 1 至 150 的整数。')
  }
  return list
})
function apply() {
  if (props.disabled || issues.value.length || !props.targets.length) return
  const patch: LayerBatchPatch = {}
  if (editLoss.value) patch.loss = parse(lossText.value)
  if (editLifespan.value) patch.lifespan = parse(lifespanText.value)
  emit('apply', patch)
}
</script>

<template>
  <section
    class="batch-panel"
    aria-labelledby="batch-heading"
  >
    <div class="section-heading">
      <h3 id="batch-heading">批量修改 {{ targets.length }} 层</h3>
      <button
        type="button"
        class="button small"
        :disabled="disabled"
        @click="emit('cancel')"
      >
        取消
      </button>
    </div>
    <ul class="batch-targets">
      <li
        v-for="target in targets"
        :key="target.layer.id"
      >
        <span class="target-name"
          >第 {{ target.index + 1 }} 层 · {{ materialName(target.layer.materialId) }}</span
        >
        <span class="target-values"
          >损耗 {{ number(target.layer.loss) }}% · 寿命 {{ target.layer.lifespan }} 年</span
        >
      </li>
    </ul>
    <div class="batch-fields">
      <div class="batch-field">
        <label class="batch-toggle">
          <input
            v-model="editLoss"
            type="checkbox"
            :disabled="disabled"
          />
          修改施工损耗（%）
        </label>
        <input
          v-model="lossText"
          type="number"
          min="0"
          max="50"
          step="0.1"
          aria-label="批量施工损耗（%）"
          :disabled="disabled || !editLoss"
          :placeholder="commonLoss === null ? '各层原值不同' : ''"
        />
      </div>
      <div class="batch-field">
        <label class="batch-toggle">
          <input
            v-model="editLifespan"
            type="checkbox"
            :disabled="disabled"
          />
          修改替换寿命（年）
        </label>
        <input
          v-model="lifespanText"
          type="number"
          min="1"
          max="150"
          step="1"
          aria-label="批量替换寿命（年）"
          :disabled="disabled || !editLifespan"
          :placeholder="commonLifespan === null ? '各层原值不同' : ''"
        />
      </div>
    </div>
    <p class="muted batch-hint">未勾选的字段保持各层原值；应用后为未保存的修改，需手动保存。</p>
    <ul
      v-if="issues.length"
      class="batch-issues"
    >
      <li
        v-for="issue in issues"
        :key="issue"
      >
        {{ issue }}
      </li>
    </ul>
    <button
      class="button primary"
      type="button"
      :disabled="disabled || issues.length > 0"
      @click="apply"
    >
      应用到 {{ targets.length }} 层
    </button>
  </section>
</template>

<style scoped>
.batch-panel {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.batch-panel h3 {
  margin: 0;
  font-size: 15px;
}
.batch-targets {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--ink);
}
.target-values {
  color: var(--muted);
  margin-left: 10px;
  font-size: 11px;
}
.batch-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.batch-field {
  display: grid;
  gap: 7px;
  align-content: start;
}
.batch-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #727969;
}
.batch-toggle input {
  width: auto;
  padding: 0;
  accent-color: var(--green);
}
.batch-hint {
  font-size: 11px;
  margin: 16px 0 0;
}
.batch-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
}
.batch-panel > .button {
  margin-top: 8px;
}
@media (max-width: 600px) {
  .batch-fields {
    grid-template-columns: 1fr;
  }
}
</style>
