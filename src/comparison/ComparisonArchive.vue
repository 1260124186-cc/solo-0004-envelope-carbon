<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { ComparisonRecord } from './types'
import { date, number, signed } from '../shared/format'
import { surfaceLabels } from '../assemblies/types'
const props = defineProps<{
  comparisons: ComparisonRecord[]
  busy: boolean
  canSave: boolean
}>()
const emit = defineEmits<{ save: []; export: [id: string] }>()
const selectedId = shallowRef('')
watch(
  () => props.comparisons,
  (comparisons) => {
    if (!comparisons.some((record) => record.id === selectedId.value))
      selectedId.value = comparisons[0]?.id ?? ''
  },
  { immediate: true },
)
const selected = computed(() => props.comparisons.find((record) => record.id === selectedId.value))
</script>

<template>
  <section
    class="comparison-archive panel"
    aria-label="已保存的比较结果"
  >
    <div class="archive-heading">
      <div>
        <span class="eyebrow">对比报告导出</span>
        <h2>把比较结论与依据留给他人复核</h2>
      </div>
      <button
        class="button"
        :disabled="busy || !canSave"
        :title="canSave ? '' : '请先选择两个同口径的已保存构造，并保存草稿修改'"
        @click="emit('save')"
      >
        保存当前比较结果
      </button>
    </div>
    <p class="section-intro">
      保存时冻结两个已保存构造的参数、逐层材料、物性与计算结果；此后无论草稿或材料目录如何修改，导出的报告都取自这份记录。
    </p>
    <div
      v-if="!comparisons.length"
      class="empty-state"
    >
      尚无已保存的比较结果。当前比较有效时，点击「保存当前比较结果」。
    </div>
    <template v-else>
      <label class="record-select"
        >选择已保存的比较结果
        <select v-model="selectedId">
          <option
            v-for="record in comparisons"
            :key="record.id"
            :value="record.id"
          >
            {{ date(record.createdAt) }} · {{ record.baseline.assembly.name }} →
            {{ record.alternative.assembly.name }}
          </option>
        </select>
      </label>
      <div
        v-if="selected"
        class="record-summary"
      >
        <p class="record-meta">
          {{ surfaceLabels[selected.baseline.assembly.surface] }} ·
          {{ number(selected.baseline.assembly.area) }} 平方米 ·
          {{ selected.baseline.assembly.years }} 年（两侧相同口径）
        </p>
        <table>
          <caption class="sr-only">
            已冻结的比较差值
          </caption>
          <tbody>
            <tr>
              <th scope="row">生命周期碳强度差值</th>
              <td data-check="saved-carbon-delta">{{ signed(selected.carbonDelta) }}</td>
              <td>千克二氧化碳当量/平方米</td>
            </tr>
            <tr>
              <th scope="row">相对基准变化</th>
              <td>
                {{ selected.percent === null ? '—' : `${signed(selected.percent)}%` }}
              </td>
              <td>差值占基准强度比例</td>
            </tr>
            <tr>
              <th scope="row">整个构造隐含碳差值</th>
              <td>{{ signed(selected.wholeDelta) }}</td>
              <td>千克二氧化碳当量</td>
            </tr>
            <tr>
              <th scope="row">传热系数差值</th>
              <td>{{ signed(selected.thermalDelta) }}</td>
              <td>瓦/(平方米·开尔文)</td>
            </tr>
          </tbody>
        </table>
        <button
          class="button primary"
          :disabled="busy"
          @click="emit('export', selected.id)"
        >
          下载中文对比报告
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.comparison-archive {
  margin-top: 28px;
}
.archive-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.record-select {
  max-width: 560px;
  margin: 8px 0 20px;
}
.record-summary {
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.record-meta {
  font-size: 12px;
  color: var(--muted);
}
.record-summary table {
  max-width: 720px;
}
.record-summary th {
  width: 260px;
}
@media (max-width: 600px) {
  .archive-heading {
    flex-direction: column;
    align-items: start;
  }
}
</style>
