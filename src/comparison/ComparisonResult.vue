<script setup lang="ts">
import type { Comparison } from './compare'
import { number, signed } from '../shared/format'
const props = defineProps<{ result: Comparison; baselineName: string; alternativeName: string }>()
const rows = [
  { label: '初始隐含碳', key: 'initial' },
  { label: '替换隐含碳', key: 'replacement' },
  { label: '生命周期强度', key: 'intensity' },
  { label: '整个构造隐含碳', key: 'whole' },
  { label: '传热系数', key: 'transmittance' },
  { label: '构造总厚度（毫米）', key: 'thickness' },
] as const
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
        相对基准 <b>{{ signed(result.percent) }}%</b>
      </p>
      <p v-else>基准强度为零，不计算变化比例。</p>
    </div>
    <div class="table-scroll">
      <table>
        <caption class="sr-only">
          基准与替代构造计算结果
        </caption>
        <thead>
          <tr>
            <th scope="col">计算项</th>
            <th scope="col">{{ baselineName }}</th>
            <th scope="col">{{ alternativeName }}</th>
            <th scope="col">差值</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
          >
            <th scope="row">{{ row.label }}</th>
            <td>{{ number(result.baseline[row.key]) }}</td>
            <td>{{ number(result.alternative[row.key]) }}</td>
            <td>{{ signed(result.alternative[row.key] - result.baseline[row.key]) }}</td>
          </tr>
        </tbody>
      </table>
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
