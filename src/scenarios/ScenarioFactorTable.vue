<script setup lang="ts">
import { computed } from 'vue'
import type { Material } from '../materials/types'
import type { FactorRange, ScenarioKey, ScenarioStudy } from './types'
import { number } from '../shared/format'
const props = defineProps<{
  study: ScenarioStudy
  materials: Material[]
  findings: { path: string; text: string }[]
  busy: boolean
}>()
const emit = defineEmits<{
  range: [materialId: string, key: ScenarioKey, value: number]
  reset: [materialId: string]
}>()
interface Row {
  material: Material
  range: FactorRange
  usedBy: number[]
  shared: boolean
  errors: string[]
}
const layerOrder = computed(() => {
  const order = new Map<string, number>()
  props.study.snapshot.assembly.layers.forEach((layer, index) => {
    if (!order.has(layer.materialId)) order.set(layer.materialId, index)
  })
  return order
})
const rows = computed<Row[]>(() =>
  props.study.snapshot.materials
    .map((material) => {
      const usedBy = props.study.snapshot.assembly.layers
        .map((layer, index) => (layer.materialId === material.id ? index + 1 : -1))
        .filter((index) => index >= 0)
      return {
        material,
        range: props.study.ranges[material.id],
        usedBy,
        shared: usedBy.length > 1,
        errors: props.findings
          .filter((finding) => finding.path === `ranges.${material.id}`)
          .map((finding) => finding.text),
      }
    })
    .sort(
      (a, b) =>
        (layerOrder.value.get(a.material.id) ?? 0) - (layerOrder.value.get(b.material.id) ?? 0),
    ),
)
const fields: { key: ScenarioKey; label: string }[] = [
  { key: 'low', label: '低值' },
  { key: 'reference', label: '参考值' },
  { key: 'high', label: '高值' },
]
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
</script>

<template>
  <div class="factor-table">
    <div
      class="table-scroll"
      role="group"
      aria-label="材料碳因子低值、参考值与高值"
    >
      <table>
        <caption>
          每种材料只设定一组范围；同一材料被多个构造层引用时，各层一致使用本次研究的数值。
        </caption>
        <thead>
          <tr>
            <th scope="col">材料（按首次出现的层排列）</th>
            <th
              v-for="field in fields"
              :key="field.key"
              scope="col"
            >
              {{ field.label }}<small>千克当量/千克</small>
            </th>
            <th scope="col">
              <span class="sr-only">恢复</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.material.id"
            :class="{ shared: row.shared }"
          >
            <th scope="row">
              <div class="material-cell">
                <strong>{{ row.material.name }}</strong>
                <span>
                  用于第 {{ row.usedBy.join('、') }} 层
                  <template v-if="row.shared"> · 多层共用，保持一致</template>
                </span>
                <span class="frozen-factor">目录冻结因子 {{ number(row.material.factor) }}</span>
              </div>
            </th>
            <td
              v-for="field in fields"
              :key="field.key"
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.001"
                :aria-label="`${row.material.name}碳因子${field.label}`"
                :disabled="busy"
                :value="row.range?.[field.key]"
                @input="emit('range', row.material.id, field.key, numeric($event))"
              />
            </td>
            <td>
              <button
                type="button"
                class="button small"
                :disabled="busy"
                :aria-label="`将${row.material.name}恢复为目录冻结因子`"
                title="恢复为目录冻结因子"
                @click="emit('reset', row.material.id)"
              >
                恢复
              </button>
            </td>
          </tr>
          <tr
            v-for="row in rows.filter((item) => item.errors.length)"
            :key="`${row.material.id}-error`"
            class="error-row"
          >
            <td :colspan="5">
              <p
                v-for="text in row.errors"
                :key="text"
              >
                {{ text }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.factor-table caption {
  margin-bottom: 12px;
  line-height: 1.7;
}
th small {
  display: block;
  font-size: 10px;
  font-weight: 400;
  color: var(--muted);
}
.material-cell {
  display: grid;
  gap: 3px;
}
.material-cell strong {
  font-weight: 600;
}
.material-cell span {
  font-size: 10px;
  color: var(--muted);
  font-weight: 400;
  white-space: normal;
}
.material-cell .frozen-factor {
  color: #8a7a44;
}
tr.shared {
  background: #f6f3e4;
}
.factor-table input {
  width: 110px;
  padding: 8px 9px;
}
.error-row td {
  padding: 4px 12px 10px;
  background: #fff0eb;
  color: #922f20;
  font-size: 11px;
  white-space: normal;
}
.error-row p {
  margin: 2px 0;
}
@media (max-width: 720px) {
  .factor-table input {
    width: 100%;
  }
}
</style>
