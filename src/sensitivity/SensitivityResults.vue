<script setup lang="ts">
import { computed } from 'vue'
import type { Crossing, SweepPoint } from './types'
import { number } from '../shared/format'
const props = defineProps<{
  points: SweepPoint[]
  crossings: Crossing[]
  label: string
  unit: string
  current?: number
  carbonLimit: number
  thermalLimit: number
}>()
const bothPass = computed(
  () => props.points.filter((point) => point.carbonPass && point.thermalPass).length,
)
function isCurrent(value: number): boolean {
  return (
    props.current !== undefined &&
    Math.abs(value - props.current) <= 1e-9 * Math.max(1, Math.abs(props.current))
  )
}
function crossingText(crossing: Crossing): string {
  const metric = crossing.metric === 'carbon' ? '隐含碳强度' : '传热系数'
  const limit = crossing.metric === 'carbon' ? props.carbonLimit : props.thermalLimit
  const direction = crossing.direction === 'into' ? '由未达标转为达标' : '由达标转为未达标'
  return `${metric}在 ${props.label} ≈ ${number(crossing.at)} ${props.unit} 处${direction}（目标 ≤ ${number(limit)}，介于 ${number(crossing.fromValue)} 与 ${number(crossing.toValue)} ${props.unit} 之间）。`
}
</script>

<template>
  <div class="sensitivity-results">
    <div class="sweep-summary">
      <div>
        <span class="eyebrow">候选点</span>
        <strong data-check="sweep-total">{{ points.length }}</strong>
      </div>
      <div>
        <span class="eyebrow">双目标达标</span>
        <strong data-check="sweep-pass">{{ bothPass }}</strong>
      </div>
      <div>
        <span class="eyebrow">未同时达标</span>
        <strong>{{ points.length - bothPass }}</strong>
      </div>
    </div>
    <div
      v-if="crossings.length"
      class="crossing-list"
    >
      <h3>目标边界临界点</h3>
      <p
        v-for="crossing in crossings"
        :key="`${crossing.metric}-${crossing.at}`"
        data-check="crossing"
      >
        {{ crossingText(crossing) }}
      </p>
    </div>
    <p
      v-else
      class="no-crossing"
    >
      扫描范围内结果未跨越任何目标边界。
    </p>
    <div class="table-scroll sweep-table">
      <table>
        <caption>
          逐一候选的计算结果 · 其余条件保持构造原值
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ label }}（{{ unit }}）</th>
            <th scope="col">隐含碳强度</th>
            <th scope="col">碳目标 ≤ {{ number(carbonLimit) }}</th>
            <th scope="col">传热系数</th>
            <th scope="col">热目标 ≤ {{ number(thermalLimit) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="point in points"
            :key="point.value"
            :class="{ 'is-current': isCurrent(point.value) }"
          >
            <th scope="row">
              {{ number(point.value)
              }}<span
                v-if="isCurrent(point.value)"
                class="current-tag"
                >当前</span
              >
            </th>
            <td>{{ number(point.intensity) }}</td>
            <td>
              <span :class="['verdict', { fail: !point.carbonPass }]">{{
                point.carbonPass ? '✓ 达标' : '✗ 超标'
              }}</span>
            </td>
            <td>{{ number(point.transmittance) }}</td>
            <td>
              <span :class="['verdict', { fail: !point.thermalPass }]">{{
                point.thermalPass ? '✓ 达标' : '✗ 超标'
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="sweep-units">
      强度单位为千克二氧化碳当量/平方米，传热系数单位为瓦/（平方米·开尔文）。临界点由相邻候选线性插值得到。
    </p>
  </div>
</template>

<style scoped>
.sweep-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  border-block: 1px solid var(--line);
  padding: 18px 0;
  margin: 20px 0;
}
.sweep-summary strong {
  display: block;
  font-size: 30px;
  font-weight: 500;
  color: var(--green);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}
.crossing-list {
  background: var(--green-pale);
  border-left: 3px solid var(--green);
  padding: 16px 20px;
  margin-bottom: 20px;
}
.crossing-list h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.crossing-list p {
  margin: 6px 0;
  font-size: 12px;
  line-height: 1.8;
}
.no-crossing {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 20px;
}
.sweep-table {
  max-height: 420px;
  overflow: auto;
  margin-top: 0;
}
.sweep-table thead th {
  position: sticky;
  top: 0;
  background: #f3f5ec;
}
.verdict {
  font-size: 11px;
  color: var(--green);
}
.verdict.fail {
  color: #995128;
}
.is-current th {
  background: var(--green-pale);
}
.current-tag {
  margin-left: 8px;
  font-size: 10px;
  color: var(--green);
  border: 1px solid var(--green);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.sweep-units {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
}
@media (max-width: 600px) {
  .sweep-summary {
    grid-template-columns: 1fr;
  }
}
</style>
