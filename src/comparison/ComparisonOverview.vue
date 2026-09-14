<script setup lang="ts">
import { computed } from 'vue'
import type { ComparisonOverview } from './compare'
import { number, signed } from '../shared/format'
const props = defineProps<{ overview: ComparisonOverview; baselineName: string }>()
const included = computed(() =>
  props.overview.entries.flatMap((entry) =>
    entry.comparison
      ? [
          {
            id: entry.assembly.id,
            name: entry.assembly.name,
            intensity: entry.comparison.carbonDelta,
            whole: entry.comparison.wholeDelta,
            transmittance: entry.comparison.thermalDelta,
            thickness: entry.comparison.alternative.thickness - entry.comparison.baseline.thickness,
            percent: entry.comparison.percent,
          },
        ]
      : [],
  ),
)
const excluded = computed(() => props.overview.entries.filter((entry) => !entry.comparison))
const zeroBaseline = computed(() => included.value.some((row) => row.percent === null))
</script>

<template>
  <section
    class="comparison-overview"
    aria-label="多替代比较总览"
  >
    <p class="baseline-line">
      基准「{{ baselineName }}」：强度 {{ number(overview.baseline.intensity) }} · 总量
      {{ number(overview.baseline.whole) }} · 传热系数
      {{ number(overview.baseline.transmittance) }} · 总厚度
      {{ number(overview.baseline.thickness) }} 毫米
    </p>
    <div
      v-if="included.length"
      class="table-scroll"
    >
      <table data-check="overview-table">
        <caption class="sr-only">
          各替代构造相对基准的差值
        </caption>
        <thead>
          <tr>
            <th scope="col">替代构造</th>
            <th scope="col">强度差值</th>
            <th scope="col">总量差值</th>
            <th scope="col">传热系数差值</th>
            <th scope="col">总厚度差值（毫米）</th>
            <th scope="col">相对基准</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in included"
            :key="row.id"
          >
            <th scope="row">{{ row.name }}</th>
            <td>{{ signed(row.intensity) }}</td>
            <td>{{ signed(row.whole) }}</td>
            <td>{{ signed(row.transmittance) }}</td>
            <td>{{ signed(row.thickness) }}</td>
            <td>{{ row.percent === null ? '—' : `${signed(row.percent)}%` }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-else
      class="empty-state"
    >
      没有口径一致的替代构造参与总览。
    </p>
    <div
      v-if="excluded.length"
      class="excluded-list"
      data-check="overview-excluded"
    >
      <h3>未参与比较的构造</h3>
      <ul>
        <li
          v-for="entry in excluded"
          :key="entry.assembly.id"
        >
          <strong>{{ entry.assembly.name }}</strong>
          <span
            v-for="reason in entry.exclusions"
            :key="reason"
            >{{ reason }}</span
          >
        </li>
      </ul>
    </div>
    <div class="overview-notes">
      <p
        v-for="note in overview.notes"
        :key="note"
      >
        {{ note }}
      </p>
      <p v-if="zeroBaseline">基准强度为零，不计算变化比例。</p>
      <p>
        强度单位为千克二氧化碳当量/平方米，总量单位为千克二氧化碳当量，传热系数单位为瓦/（平方米·开尔文）。
      </p>
    </div>
  </section>
</template>

<style scoped>
.baseline-line {
  background: var(--green-pale);
  border-left: 3px solid var(--green);
  padding: 14px 18px;
  font-size: 12px;
  line-height: 1.8;
  margin: 0;
}
.excluded-list {
  border: 1px dashed #ccd5c7;
  border-radius: 6px;
  background: #f6f7f0;
  padding: 18px 20px;
  margin: 20px 0;
}
.excluded-list h3 {
  margin: 0 0 10px;
  font-size: 13px;
}
.excluded-list ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}
.excluded-list li {
  display: grid;
  gap: 3px;
  font-size: 12px;
  color: var(--muted);
}
.excluded-list strong {
  color: var(--ink);
  font-weight: 500;
}
.overview-notes {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
}
</style>
