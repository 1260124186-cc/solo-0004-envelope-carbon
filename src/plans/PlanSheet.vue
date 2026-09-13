<script setup lang="ts">
import { computed } from 'vue'
import type { ReplacementPlan } from './types'
import { number, date } from '../shared/format'
import { surfaceLabels, stateLabels } from '../assemblies/types'
import { planMatchesResult } from './create'

const props = defineProps<{ plan: ReplacementPlan }>()

const reconciled = computed(() => planMatchesResult(props.plan))

function yearTitle(phase: 'initial' | 'replacement', year: number): string {
  return phase === 'initial' ? '第 0 年 · 初始材料生产' : `第 ${year} 年 · 材料替换`
}
</script>

<template>
  <section
    class="plan-sheet"
    aria-label="材料替换计划"
  >
    <div class="plan-title">
      <div>
        <span class="eyebrow">材料替换计划</span>
        <h2>{{ plan.assembly.name }}</h2>
      </div>
      <span class="plan-seal">已保存计划<br />修订 {{ plan.assembly.revision }}</span>
    </div>
    <p class="plan-meta">
      {{ surfaceLabels[plan.assembly.surface] }} · {{ number(plan.assembly.area) }} 平方米 ·
      {{ plan.assembly.years }} 年计算期 · {{ stateLabels[plan.assembly.state] }}
    </p>
    <p class="plan-meta">生成于 {{ date(plan.createdAt) }} · {{ plan.result.method }}</p>
    <div class="plan-numbers">
      <div>
        <span>初始材料生产（第 0 年）</span><strong>{{ number(plan.result.initial) }}</strong
        ><small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>计算期内替换合计</span><strong>{{ number(plan.result.replacement) }}</strong
        ><small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>生命周期累计</span
        ><strong :data-check="reconciled ? 'plan-total' : undefined">{{
          number(plan.result.intensity)
        }}</strong
        ><small>千克当量 / 平方米 · 整构造 {{ number(plan.result.whole) }}</small>
      </div>
    </div>
    <p
      class="plan-reconcile"
      :class="{ failed: !reconciled }"
    >
      {{
        reconciled
          ? '✓ 各年记录累计与该构造的生命周期结果一致。'
          : '↗ 各年记录累计与生命周期结果不一致，请重新生成计划。'
      }}
    </p>
    <div class="table-scroll">
      <table>
        <caption>
          按年份排列的材料生产与替换记录
        </caption>
        <thead>
          <tr>
            <th scope="col">发生年份</th>
            <th scope="col">材料层</th>
            <th scope="col">厚度（毫米）</th>
            <th scope="col">该层替换寿命（年）</th>
            <th scope="col">本次隐含碳（千克当量/平方米）</th>
            <th scope="col">本次整构造隐含碳（千克当量）</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="record in plan.years"
            :key="record.year"
          >
            <tr
              v-for="entry in record.entries"
              :key="`${record.year}-${entry.layerId}`"
              :data-year="String(record.year)"
            >
              <th
                v-if="entry === record.entries[0]"
                :rowspan="record.entries.length"
                scope="rowgroup"
                class="year-cell"
              >
                {{ yearTitle(record.phase, record.year) }}
              </th>
              <th scope="row">{{ entry.layerLabel }}</th>
              <td>{{ number(entry.thickness) }}</td>
              <td>{{ entry.lifespan }}</td>
              <td>{{ number(entry.carbon) }}</td>
              <td>{{ number(entry.wholeCarbon) }}</td>
            </tr>
            <tr
              class="year-total"
              :data-year-total="String(record.year)"
            >
              <td colspan="4">
                {{
                  record.phase === 'initial'
                    ? '第 0 年初始生产合计'
                    : `第 ${record.year} 年替换合计`
                }}
              </td>
              <td>{{ number(record.total) }}</td>
              <td>{{ number(record.wholeTotal) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p class="plan-rule">
      第 0 年单独列出初始材料生产；恰好发生在计算期终点（第 {{ plan.assembly.years }}
      年）的替换按边界规则不计入。同一材料出现在不同层时以「第 n 层」区分。
    </p>
    <div class="plan-notes">
      <h3>冻结的构造与物性</h3>
      <p class="plan-meta">
        本计划保存生成时采用的构造与材料物性，后续编辑原构造不会改变本记录；再次生成将形成另一份计划。
      </p>
      <p
        v-for="material in plan.materials"
        :key="material.id"
      >
        {{ material.name }}：密度 {{ material.density }} 千克/立方米 · 碳因子
        {{ material.factor }} 千克当量/千克 · {{ material.source }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.plan-sheet {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 32px;
  border-radius: 6px;
  max-width: 1000px;
}
.plan-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 20px;
}
.plan-title h2 {
  font-size: 24px;
  margin: 12px 0 0;
}
.plan-seal {
  color: var(--green);
  border: 1px solid var(--green);
  font-size: 11px;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.6;
  white-space: nowrap;
}
.plan-meta {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.plan-numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding: 20px 0;
  margin: 24px 0 16px;
  gap: 16px;
}
.plan-numbers span,
.plan-numbers small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.plan-numbers strong {
  display: block;
  font-size: 26px;
  font-weight: 500;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
}
.plan-reconcile {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--green);
  background: var(--green-pale);
  padding: 10px 12px;
}
.plan-reconcile.failed {
  color: #995128;
  background: #fbf0db;
}
.year-cell {
  font-weight: 500;
  white-space: nowrap;
  vertical-align: top;
}
.year-total td {
  font-size: 11px;
  color: var(--muted);
  text-align: right;
}
.year-total td:nth-child(5),
.year-total td:nth-child(6) {
  color: var(--ink);
  font-weight: 600;
}
.plan-rule {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.plan-notes {
  margin-top: 20px;
  font-size: 11px;
  line-height: 1.8;
}
.plan-notes h3 {
  font-size: 12px;
}
@media (max-width: 600px) {
  .plan-sheet {
    padding: 20px;
  }
  .plan-numbers {
    grid-template-columns: 1fr;
  }
}
</style>
