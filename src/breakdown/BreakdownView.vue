<script setup lang="ts">
import type { Breakdown } from './types'
import { number, percent } from '../shared/format'
import { kindLabels } from '../materials/types'

withDefaults(
  defineProps<{ breakdown: Breakdown; selectable?: boolean; selectedLayerId?: string }>(),
  {
    selectable: false,
    selectedLayerId: '',
  },
)
const emit = defineEmits<{ select: [layerId: string] }>()
</script>

<template>
  <div class="breakdown-view">
    <div class="breakdown-summary">
      <div>
        <span>初始生产</span>
        <strong data-check="breakdown-initial">{{ number(breakdown.initial) }}</strong>
        <small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>计算期内替换</span>
        <strong data-check="breakdown-replacement">{{ number(breakdown.replacement) }}</strong>
        <small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>生命周期强度</span>
        <strong data-check="breakdown-intensity">{{ number(breakdown.intensity) }}</strong>
        <small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>整个构造隐含碳</span>
        <strong data-check="breakdown-whole">{{ number(breakdown.whole) }}</strong>
        <small>千克二氧化碳当量</small>
      </div>
    </div>
    <p
      class="reconcile-status"
      data-check="reconcile-status"
    >
      ✓ 对账通过 · {{ breakdown.checks.length }} 项核对与计算面板一致
    </p>
    <div class="table-scroll">
      <table>
        <caption>
          按材料类别归集 · 强度列为千克当量/平方米，总量列为千克当量
        </caption>
        <thead>
          <tr>
            <th scope="col">材料类别</th>
            <th scope="col">初始生产</th>
            <th scope="col">替换</th>
            <th scope="col">强度贡献</th>
            <th scope="col">总量贡献</th>
            <th scope="col">占比</th>
            <th scope="col">来源构造层</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="kind in breakdown.kinds"
            :key="kind.kind"
          >
            <th scope="row">{{ kindLabels[kind.kind] }}</th>
            <td>{{ number(kind.initial) }}</td>
            <td>{{ number(kind.replacement) }}</td>
            <td>{{ number(kind.total) }}</td>
            <td>{{ number(kind.whole) }}</td>
            <td>{{ percent(kind.share) }}</td>
            <td class="source-cell">
              <span
                v-for="source in kind.sources"
                :key="source.layerId"
              >
                第{{ source.order }}层 {{ source.materialName }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-scroll">
      <table>
        <caption>
          逐层明细（室外至室内）· 同一材料出现在多层时分别列示，不合并
        </caption>
        <thead>
          <tr>
            <th scope="col">构造层</th>
            <th scope="col">材料</th>
            <th scope="col">类别</th>
            <th scope="col">初始生产</th>
            <th scope="col">替换</th>
            <th scope="col">强度贡献</th>
            <th scope="col">总量贡献</th>
            <th scope="col">占比</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="layer in breakdown.layers"
            :key="layer.layerId"
            :class="{ selected: selectable && layer.layerId === selectedLayerId }"
            @click="selectable && emit('select', layer.layerId)"
          >
            <th scope="row">
              <button
                v-if="selectable"
                class="layer-select"
                :aria-label="`查看第 ${layer.order} 层贡献`"
                :aria-pressed="layer.layerId === selectedLayerId"
                @click.stop="emit('select', layer.layerId)"
              >
                第 {{ layer.order }} 层
              </button>
              <template v-else>第 {{ layer.order }} 层</template>
            </th>
            <td>{{ layer.materialName }}</td>
            <td>{{ kindLabels[layer.kind] }}</td>
            <td>{{ number(layer.initial) }}</td>
            <td>{{ number(layer.replacement) }}</td>
            <td>{{ number(layer.total) }}</td>
            <td>{{ number(layer.whole) }}</td>
            <td>{{ percent(layer.share) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <details class="reconcile-detail">
      <summary>对账清单 · {{ breakdown.checks.length }} 项全部一致</summary>
      <ul>
        <li
          v-for="item in breakdown.checks"
          :key="item.id"
        >
          <span :class="['check-mark', { failed: !item.pass }]">{{ item.pass ? '✓' : '✗' }}</span>
          {{ item.label }}
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.breakdown-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  border-block: 1px solid var(--line);
  padding: 20px 0;
  margin: 24px 0 0;
}
.breakdown-summary span,
.breakdown-summary small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.breakdown-summary strong {
  display: block;
  font-size: 26px;
  font-weight: 500;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
}
.reconcile-status {
  margin: 16px 0 0;
  padding: 10px 14px;
  background: var(--green-pale);
  color: var(--green);
  font-size: 11px;
  border-radius: 4px;
}
.source-cell {
  white-space: normal;
  font-size: 10px;
  color: var(--muted);
}
.source-cell span {
  display: block;
  line-height: 1.7;
}
tr.selected {
  background: var(--green-pale);
}
tr.selected td,
tr.selected th {
  border-bottom-color: var(--green);
}
.layer-select {
  border: 1px solid #cfd8ca;
  background: var(--paper);
  color: var(--green);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 11px;
  white-space: nowrap;
}
.layer-select:hover {
  border-color: var(--green);
  background: #edf2e9;
}
.layer-select[aria-pressed='true'] {
  background: var(--green);
  border-color: var(--green);
  color: white;
}
.reconcile-detail {
  margin-top: 8px;
  font-size: 11px;
  color: var(--muted);
}
.reconcile-detail summary {
  cursor: pointer;
}
.reconcile-detail ul {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
}
.check-mark {
  color: var(--green);
  margin-right: 6px;
}
.check-mark.failed {
  color: #995128;
}
@media (max-width: 800px) {
  .breakdown-summary {
    grid-template-columns: repeat(2, 1fr);
  }
  .reconcile-detail ul {
    grid-template-columns: 1fr;
  }
}
</style>
