<script setup lang="ts">
import type { EntryEvaluation, SchemeEvaluation } from './types'
import { surfaceLabels, stateLabels } from '../assemblies/types'
import { number } from '../shared/format'

defineProps<{ evaluation: SchemeEvaluation | null }>()

function statusText(entry: EntryEvaluation): string {
  if (entry.status === 'current') return '引用为最新'
  if (entry.acknowledged) {
    return entry.status === 'missing'
      ? '原构造已删除 · 已按冻结版本保留'
      : '原构造已修改 · 已按冻结版本保留'
  }
  return entry.status === 'modified' ? '原构造已修改 · 待选择' : '原构造已删除 · 待处理'
}
</script>

<template>
  <aside
    class="scheme-summary"
    aria-label="组合计算结果"
  >
    <div class="result-header">
      <span class="eyebrow">组合测算</span><span class="small-dot">按冻结引用计算</span>
    </div>
    <template v-if="evaluation && !evaluation.findings.length">
      <template v-if="evaluation.consistent">
        <div class="primary-result">
          <p>组合平均隐含碳强度</p>
          <strong data-check="scheme-intensity">{{ number(evaluation.intensity ?? 0) }}</strong>
          <span>千克二氧化碳当量 / 平方米（按 {{ number(evaluation.totalArea) }} 平方米折算）</span>
        </div>
        <dl class="result-lines">
          <div class="result-total">
            <dt>整个组合隐含碳总量</dt>
            <dd data-check="scheme-total">
              {{ number(evaluation.totalCarbon ?? 0) }} <small>千克当量</small>
            </dd>
          </div>
          <div>
            <dt>统一计算年限</dt>
            <dd>{{ evaluation.yearSets[0] }} 年</dd>
          </div>
        </dl>
      </template>
      <div
        v-else
        class="mixed-warning"
      >
        <strong>计算年限不一致，不能直接混算总量。</strong>
        <p>
          组合中的构造分别采用 {{ evaluation.yearSets.join('、') }}
          年计算期，替换次数不同，生命周期口径不一致。以下仅给出分年限小计与各部位结果；统一各构造年限后才会显示组合总量与平均强度。
        </p>
      </div>
      <div class="table-scroll">
        <table>
          <caption>
            按计算年限分组
          </caption>
          <thead>
            <tr>
              <th scope="col">计算年限</th>
              <th scope="col">总面积（平方米）</th>
              <th scope="col">隐含碳（千克当量）</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="years in evaluation.yearSets"
              :key="years"
            >
              <td>{{ years }} 年</td>
              <td>
                {{
                  number(
                    evaluation.entries
                      .filter((entry) => entry.years === years)
                      .reduce((sum, entry) => sum + entry.entry.area, 0),
                  )
                }}
              </td>
              <td :class="{ 'mixed-cell': !evaluation.consistent }">
                {{
                  number(
                    evaluation.entries
                      .filter((entry) => entry.years === years)
                      .reduce((sum, entry) => sum + entry.whole, 0),
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="method-note">
        各部位隐含碳 = 冻结构造的每平方米生命周期强度 ×
        组合内实际面积。组合面积仅属于本组合，不改变原构造。
      </p>
    </template>
    <div
      v-else-if="evaluation"
      class="invalid-calculation"
    >
      <h3>补全组合后开始计算</h3>
      <ul>
        <li
          v-for="issue in evaluation.findings"
          :key="issue.path + issue.text"
        >
          {{ issue.text }}
        </li>
      </ul>
    </div>
    <template v-if="evaluation && evaluation.entries.length">
      <div class="table-scroll entries-scroll">
        <table>
          <caption>
            各部位引用状态
          </caption>
          <thead>
            <tr>
              <th scope="col">部位</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in evaluation.entries"
              :key="entry.entry.id"
            >
              <td>
                {{ surfaceLabels[entry.entry.snapshot.surface] }} · {{ entry.entry.name }}
                <small
                  >（{{ stateLabels[entry.entry.snapshot.state] }} · 修订
                  {{ entry.entry.revision }}）</small
                >
              </td>
              <td :class="['status-' + entry.status, { acknowledged: entry.acknowledged }]">
                {{ statusText(entry) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.scheme-summary {
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
  font-size: 48px;
  font-weight: 500;
  letter-spacing: -2px;
  color: var(--green);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.primary-result > span {
  color: var(--muted);
  font-size: 10px;
}
.result-lines {
  margin: 16px 24px 0;
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
.result-total small {
  color: var(--muted);
  font-size: 10px;
}
.mixed-warning {
  margin: 18px 24px 0;
  padding: 12px 14px;
  background: #fcf3de;
  color: #865629;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.7;
}
.mixed-warning p {
  margin: 6px 0 0;
  font-size: 11px;
}
.mixed-cell {
  color: #865629;
}
.method-note {
  margin: 0 24px 20px;
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
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
.entries-scroll {
  margin: 0;
}
.status-modified,
.status-missing {
  color: #995128;
}
.status-kept {
  color: var(--muted);
}
@media (max-width: 1000px) {
  .scheme-summary {
    position: static;
  }
}
</style>
