<script setup lang="ts">
import type { Assembly } from '../assemblies/types'
import type { StudyEvaluation } from './types'
import { scenarioOrder } from './types'
import { number } from '../shared/format'
defineProps<{ evaluation: StudyEvaluation; assembly: Assembly }>()
</script>

<template>
  <section
    class="scenario-results"
    aria-label="三种参数情景的计算结果"
  >
    <div class="scenario-cards">
      <article
        v-for="key in scenarioOrder"
        :key="key"
        :class="['scenario-card', { exceeded: !evaluation.scenarios[key].carbonPass }]"
      >
        <span class="eyebrow">{{ evaluation.scenarios[key].label }}</span>
        <strong data-check="scenario-intensity">{{
          number(evaluation.scenarios[key].calculation.intensity)
        }}</strong>
        <small>千克二氧化碳当量 / 平方米</small>
        <dl>
          <div>
            <dt>初始生产</dt>
            <dd>{{ number(evaluation.scenarios[key].calculation.initial) }}</dd>
          </div>
          <div>
            <dt>期内替换</dt>
            <dd>{{ number(evaluation.scenarios[key].calculation.replacement) }}</dd>
          </div>
          <div>
            <dt>构造总量</dt>
            <dd>{{ number(evaluation.scenarios[key].calculation.whole) }} 千克当量</dd>
          </div>
        </dl>
        <p class="target-status">
          {{
            evaluation.scenarios[key].carbonPass
              ? '✓ 达到碳强度目标（≤ ' + number(assembly.carbonLimit) + '）'
              : '↗ 超出碳强度目标（≤ ' + number(assembly.carbonLimit) + '）'
          }}
        </p>
      </article>
    </div>
    <p class="spread-note">
      强度区间
      <b data-check="scenario-span"
        >{{ number(evaluation.scenarios.low.calculation.intensity) }} –
        {{ number(evaluation.scenarios.high.calculation.intensity) }}</b
      >
      千克当量/平方米；构造总量区间
      <b
        >{{ number(evaluation.scenarios.low.calculation.whole) }} –
        {{ number(evaluation.scenarios.high.calculation.whole) }}</b
      >
      千克当量。各情景仅改变单位质量碳因子，热阻与传热系数不变。
    </p>
    <details class="layer-scenarios">
      <summary>逐层隐含碳对照（千克当量/平方米）</summary>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">
            同一材料在所有引用层使用相同情景因子
          </caption>
          <thead>
            <tr>
              <th scope="col">层</th>
              <th scope="col">材料</th>
              <th scope="col">低值</th>
              <th scope="col">参考值</th>
              <th scope="col">高值</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(layer, index) in evaluation.scenarios.reference.calculation.layers"
              :key="layer.layerId"
            >
              <th scope="row">第 {{ index + 1 }} 层</th>
              <td>{{ layer.materialName }}</td>
              <td>{{ number(evaluation.scenarios.low.calculation.layers[index].total) }}</td>
              <td>{{ number(evaluation.scenarios.reference.calculation.layers[index].total) }}</td>
              <td>{{ number(evaluation.scenarios.high.calculation.layers[index].total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
.scenario-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.scenario-card {
  border: 1px solid var(--line);
  border-top: 3px solid var(--green);
  background: #fbfdf8;
  border-radius: 6px;
  padding: 18px;
}
.scenario-card.exceeded {
  border-top-color: #a35a2d;
  background: #fdf7ef;
}
.scenario-card strong {
  display: block;
  font-size: 38px;
  font-weight: 500;
  color: var(--green);
  margin: 6px 0 2px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.scenario-card.exceeded strong {
  color: #995128;
}
.scenario-card small {
  font-size: 10px;
  color: var(--muted);
}
.scenario-card dl {
  margin: 14px 0 0;
  font-size: 11px;
}
.scenario-card dl > div {
  display: flex;
  justify-content: space-between;
  margin: 7px 0;
}
.scenario-card dt {
  color: var(--muted);
}
.scenario-card dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.target-status {
  margin: 12px 0 0;
  padding: 9px 10px;
  font-size: 11px;
  background: var(--green-pale);
  color: var(--green);
}
.scenario-card.exceeded .target-status {
  background: #fbf0db;
  color: #995128;
}
.spread-note {
  margin: 16px 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.spread-note b {
  color: var(--ink);
  font-weight: 600;
}
.layer-scenarios {
  margin-top: 18px;
}
.layer-scenarios summary {
  cursor: pointer;
  font-size: 12px;
}
@media (max-width: 900px) {
  .scenario-cards {
    grid-template-columns: 1fr;
  }
}
</style>
