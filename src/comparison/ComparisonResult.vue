<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Comparison } from './compare'
import { number, signed } from '../shared/format'
const props = defineProps<{ result: Comparison; baselineName: string; alternativeName: string }>()
const onlyChanged = ref(false)
const rows = [
  { label: '初始隐含碳', key: 'initial' },
  { label: '替换隐含碳', key: 'replacement' },
  { label: '生命周期强度', key: 'intensity' },
  { label: '整个构造隐含碳', key: 'whole' },
  { label: '传热系数', key: 'transmittance' },
  { label: '构造总厚度（毫米）', key: 'thickness' },
] as const
// 变化判定使用引擎输出的原始数值并要求严格不等：界面取两位小数，
// 不能以格式化后的显示值比较，否则接近相等但数值不同的项会被误判为无变化。
const changedRows = computed(() =>
  rows.filter((row) => props.result.baseline[row.key] !== props.result.alternative[row.key]),
)
const visibleRows = computed(() => (onlyChanged.value ? changedRows.value : rows))
function statusOf(pass: boolean): { text: string; className: string } {
  return pass
    ? { text: '✓ 达标', className: 'target-pass' }
    : { text: '↗ 超标', className: 'target-fail' }
}
const baselineCarbonStatus = computed(() => statusOf(props.result.baseline.carbonPass))
const alternativeCarbonStatus = computed(() => statusOf(props.result.alternative.carbonPass))
const baselineThermalStatus = computed(() => statusOf(props.result.baseline.thermalPass))
const alternativeThermalStatus = computed(() => statusOf(props.result.alternative.thermalPass))
</script>

<template>
  <section
    class="comparison-result"
    aria-label="方案比较结果"
  >
    <div class="difference-summary">
      <div>
        <span class="eyebrow">生命周期强度变化</span
        ><strong data-check="carbon-delta">{{ signed(props.result.carbonDelta) }}</strong
        ><small>千克二氧化碳当量 / 平方米</small>
      </div>
      <p v-if="result.percent !== null">
        相对基准 <b data-check="carbon-percent">{{ signed(result.percent) }}%</b>
      </p>
      <p v-else>基准强度为零，不计算变化比例。</p>
    </div>
    <div class="result-toolbar">
      <label class="filter-toggle">
        <input
          v-model="onlyChanged"
          type="checkbox"
          data-check="only-changed"
        />
        <span>只看有变化的计算项</span>
      </label>
      <small class="filter-count">{{ changedRows.length }} / {{ rows.length }} 项有数值变化</small>
    </div>
    <div class="table-scroll">
      <table>
        <caption class="sr-only">
          基准与替代构造计算结果
        </caption>
        <thead>
          <tr>
            <th scope="col">计算项</th>
            <th scope="col">
              <span class="scheme-heading">{{ baselineName }}</span>
              <span :class="['status-badge', baselineCarbonStatus.className]">
                碳 {{ baselineCarbonStatus.text }}
              </span>
              <span :class="['status-badge', baselineThermalStatus.className]">
                热 {{ baselineThermalStatus.text }}
              </span>
            </th>
            <th scope="col">
              <span class="scheme-heading">{{ alternativeName }}</span>
              <span :class="['status-badge', alternativeCarbonStatus.className]">
                碳 {{ alternativeCarbonStatus.text }}
              </span>
              <span :class="['status-badge', alternativeThermalStatus.className]">
                热 {{ alternativeThermalStatus.text }}
              </span>
            </th>
            <th scope="col">差值</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in visibleRows"
            :key="row.key"
            :data-row="row.key"
          >
            <th scope="row">{{ row.label }}</th>
            <td>{{ number(result.baseline[row.key]) }}</td>
            <td>{{ number(result.alternative[row.key]) }}</td>
            <td>{{ signed(result.alternative[row.key] - result.baseline[row.key]) }}</td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="onlyChanged && changedRows.length === 0"
        class="empty-filter"
        data-check="no-changed-rows"
      >
        两个构造的各项计算结果完全相同，没有可聚焦的差异。
      </p>
    </div>
    <div class="comparison-notes">
      <p
        v-for="reason in result.reasons"
        :key="reason"
      >
        {{ reason }}
      </p>
      <p>
        强度单位为千克二氧化碳当量/平方米，总量单位为千克二氧化碳当量，传热系数单位为瓦/（平方米·开尔文）。
      </p>
    </div>
  </section>
</template>

<style scoped>
.difference-summary {
  background: var(--green-pale);
  border-left: 3px solid var(--green);
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.difference-summary strong {
  display: block;
  font-size: 44px;
  font-weight: 500;
  color: var(--green);
  margin: 10px 0 4px;
}
.difference-summary small {
  font-size: 11px;
  color: var(--muted);
}
.difference-summary p {
  font-size: 13px;
}
.difference-summary b {
  display: block;
  font-size: 24px;
  margin-top: 8px;
  font-weight: 500;
}
.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f6f7f0;
}
.filter-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: var(--ink);
}
.filter-toggle input {
  width: auto;
  margin: 0;
}
.filter-count {
  color: var(--muted);
  font-size: 11px;
}
.scheme-heading {
  display: block;
  margin-bottom: 7px;
}
.status-badge {
  display: inline-block;
  margin: 0 6px 0 0;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 1.5;
}
.target-pass {
  color: var(--green);
  background: var(--green-pale);
}
.target-fail {
  color: #995128;
  background: #fbf0db;
}
.empty-filter {
  margin: 4px 0 0;
  padding: 20px;
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  background: #f6f7f0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
.comparison-notes {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
}
@media (max-width: 600px) {
  .difference-summary {
    flex-direction: column;
    align-items: start;
  }
}
</style>
