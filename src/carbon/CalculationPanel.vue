<script setup lang="ts">
import type { Calculation } from './types'
import type { Finding } from '../assemblies/types'
import { number } from '../shared/format'
import LayerContribution from './LayerContribution.vue'
import MethodNote from './MethodNote.vue'
defineProps<{
  result: Calculation | null
  findings: Finding[]
  area: number
  years: number
  carbonLimit: number
  thermalLimit: number
}>()
</script>

<template>
  <aside
    class="calculation-panel"
    aria-label="构造计算结果"
  >
    <div class="result-header">
      <span class="eyebrow">即时计算</span><span class="small-dot">随输入更新</span>
    </div>
    <template v-if="result">
      <div class="primary-result">
        <p>生命周期隐含碳强度</p>
        <strong data-check="intensity">{{ number(result.intensity) }}</strong>
        <span>千克二氧化碳当量 / 平方米</span>
      </div>
      <p class="calculation-scope">{{ number(area) }} 平方米 · {{ years }} 年计算期</p>
      <dl class="result-lines">
        <div>
          <dt>初始材料生产</dt>
          <dd>{{ number(result.initial) }}</dd>
        </div>
        <div>
          <dt>计算期内替换</dt>
          <dd>{{ number(result.replacement) }}</dd>
        </div>
        <div class="result-total">
          <dt>整个构造隐含碳</dt>
          <dd>{{ number(result.whole) }} <small>千克当量</small></dd>
        </div>
      </dl>
      <div :class="['target-line', { exceeded: !result.carbonPass }]">
        <span>{{ result.carbonPass ? '✓ 达到碳强度目标' : '↗ 超出碳强度目标' }}</span>
        <span>目标 ≤ {{ number(carbonLimit) }}</span>
      </div>
      <div class="thermal-result">
        <div>
          <span class="eyebrow">简化传热系数</span
          ><strong>{{ number(result.transmittance) }}</strong
          ><small>瓦 /（平方米 · 开尔文）</small>
        </div>
        <span :class="['thermal-status', { exceeded: !result.thermalPass }]">{{
          result.thermalPass ? '达到目标' : '超出目标'
        }}</span>
      </div>
      <p class="thermal-help">
        上限 {{ number(thermalLimit) }} · 构造总厚 {{ number(result.thickness) }} 毫米
      </p>
      <LayerContribution :layers="result.layers" />
    </template>
    <div
      v-else
      class="invalid-calculation"
    >
      <h3>补全构造后开始计算</h3>
      <ul>
        <li
          v-for="issue in findings"
          :key="issue.path + issue.text"
        >
          {{ issue.text }}
        </li>
      </ul>
    </div>
    <MethodNote />
  </aside>
</template>

<style scoped>
.calculation-panel {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  align-self: start;
  position: sticky;
  top: 20px;
}
.result-header {
  display: flex;
  justify-content: space-between;
  padding: 22px 24px 0;
}
.small-dot {
  font-size: 10px;
  color: var(--green);
}
.small-dot::before {
  content: '●';
  margin-right: 5px;
  font-size: 7px;
}
.primary-result {
  padding: 12px 24px 0;
}
.primary-result p {
  font-size: 13px;
  margin: 8px 0;
}
.primary-result strong {
  display: block;
  font-size: 62px;
  font-weight: 500;
  letter-spacing: -3px;
  color: var(--green);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.primary-result > span {
  color: var(--muted);
  font-size: 10px;
}
.calculation-scope {
  margin: 16px 24px;
  font-size: 11px;
  color: var(--muted);
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.result-lines {
  margin: 0 24px;
  font-size: 12px;
}
.result-lines > div {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
}
.result-lines dt {
  color: var(--muted);
}
.result-lines dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.result-total {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.result-total small {
  color: var(--muted);
  font-size: 10px;
}
.target-line {
  margin: 18px 24px 0;
  padding: 10px;
  background: var(--green-pale);
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--green);
}
.exceeded {
  color: #995128 !important;
  background: #fbf0db !important;
}
.thermal-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 24px 0;
}
.thermal-result strong {
  display: block;
  font-size: 32px;
  font-weight: 500;
  margin: 5px 0;
}
.thermal-result small {
  font-size: 10px;
  color: var(--muted);
}
.thermal-status {
  font-size: 10px;
  background: var(--green-pale);
  color: var(--green);
  padding: 5px 8px;
}
.thermal-help {
  margin: 12px 24px 20px;
  font-size: 10px;
  color: var(--muted);
}
.invalid-calculation {
  padding: 24px;
  font-size: 12px;
  color: #945038;
}
.invalid-calculation ul {
  padding-left: 18px;
  line-height: 1.8;
}
@media (max-width: 1000px) {
  .calculation-panel {
    position: static;
  }
}
</style>
