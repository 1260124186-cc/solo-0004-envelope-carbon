<script setup lang="ts">
import { computed } from 'vue'
import type { ComplianceRule } from '../compliance/types'
import type { CarbonDocument } from './types'
import { number, date } from '../shared/format'
import { surfaceLabels } from '../assemblies/types'
import { downloadDocument } from './download'
import { documentCompliance, documentRuleState } from './basis'
const props = defineProps<{ document: CarbonDocument; rules?: ComplianceRule[] }>()
const compliance = computed(() => documentCompliance(props.document))
// 规则现状取自当前规则表而非冻结快照：规则事后被停用/删除时，历史判定不变但要如实提示。
const ruleState = computed(() => documentRuleState(props.document, props.rules ?? []))
</script>

<template>
  <section
    class="document-sheet"
    aria-label="冻结计算书"
  >
    <div class="document-title">
      <div>
        <span class="eyebrow">围护构造计算书</span>
        <h2>{{ document.assembly.name }}</h2>
      </div>
      <span class="document-seal">已定稿<br />修订 {{ document.assembly.revision }}</span>
    </div>
    <p class="document-meta">
      {{ surfaceLabels[document.assembly.surface] }} · {{ number(document.assembly.area) }} 平方米 ·
      {{ document.assembly.years }} 年
    </p>
    <p class="document-meta">{{ date(document.createdAt) }} · {{ document.result.method }}</p>
    <div :class="['document-compliance', { exceeded: !compliance.pass }]">
      <div class="compliance-title">
        <strong>{{ compliance.pass ? '✓ 本版达到达标条件' : '↗ 本版未达到达标条件' }}</strong>
        <span>
          判定口径：{{
            compliance.mode === 'rule' ? compliance.ruleName : '构造自带目标（碳强度与传热系数）'
          }}
          <em v-if="ruleState === 'deactivated'"> （该规则现已停用，仍按定稿时口径显示） </em>
          <em v-else-if="ruleState === 'missing'"> （该规则已被移除，仍按定稿时口径显示） </em>
        </span>
      </div>
      <p
        v-if="ruleState === 'deactivated' || ruleState === 'missing'"
        class="compliance-current-note"
      >
        规则的后续变化不追溯改变本计算书：以下条件与结论为定稿时冻结的历史判定依据。
      </p>
      <ul>
        <li
          v-for="condition in compliance.conditions"
          :key="condition.metric"
          :class="{ exceeded: !condition.pass }"
        >
          <span>{{ condition.pass ? '✓' : '↗' }} {{ condition.label }}</span>
          <span
            >实际 {{ number(condition.actual) }} / 上限 {{ number(condition.limit) }}
            {{ condition.unit }}</span
          >
        </li>
      </ul>
    </div>
    <div class="document-numbers">
      <div>
        <span>生命周期强度</span
        ><strong data-check="frozen-intensity">{{ number(document.result.intensity) }}</strong
        ><small>千克当量 / 平方米</small>
      </div>
      <div>
        <span>整个构造隐含碳</span><strong>{{ number(document.result.whole) }}</strong
        ><small>千克二氧化碳当量</small>
      </div>
      <div>
        <span>简化传热系数</span><strong>{{ number(document.result.transmittance) }}</strong
        ><small>瓦 / 平方米·开尔文</small>
      </div>
    </div>
    <div class="table-scroll">
      <table>
        <caption>
          冻结的逐层计算
        </caption>
        <thead>
          <tr>
            <th scope="col">材料</th>
            <th scope="col">厚度（毫米）</th>
            <th scope="col">替换次数</th>
            <th scope="col">隐含碳（千克当量/平方米）</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="layer in document.result.layers"
            :key="layer.layerId"
          >
            <th scope="row">{{ layer.materialName }}</th>
            <td>{{ number(layer.thickness) }}</td>
            <td>{{ layer.cycles }}</td>
            <td>{{ number(layer.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="document-notes">
      <h3>设计说明</h3>
      <p>{{ document.assembly.note || '无补充说明。' }}</p>
      <h3>参数来源</h3>
      <p
        v-for="material in document.materials"
        :key="material.id"
      >
        {{ material.name }}：{{ material.source }}
      </p>
      <p>本计算书冻结生成时的输入与结果，后续构造修改不会改变本版本。</p>
    </div>
    <button
      class="button primary"
      @click="downloadDocument(document, rules ?? [])"
    >
      下载计算书
    </button>
  </section>
</template>

<style scoped>
.document-sheet {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 32px;
  border-radius: 6px;
  max-width: 900px;
}
.document-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 2px solid var(--green);
  padding-bottom: 20px;
}
.document-title h2 {
  font-size: 24px;
  margin: 12px 0 0;
}
.document-seal {
  color: var(--green);
  border: 1px solid var(--green);
  font-size: 11px;
  text-align: center;
  padding: 8px 14px;
  line-height: 1.6;
  white-space: nowrap;
}
.document-meta {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.document-compliance {
  margin: 18px 0 0;
  border: 1px solid #b9cdbb;
  background: var(--green-pale);
  color: var(--green);
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 12px;
}
.document-compliance.exceeded {
  border-color: #ddbd94;
  background: #fbf0db;
  color: #995128;
}
.compliance-title {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.compliance-title span {
  font-size: 11px;
  opacity: 0.85;
}
.compliance-title em {
  font-style: normal;
}
.compliance-current-note {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.7;
  opacity: 0.85;
}
.document-compliance ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.document-compliance li {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  background: rgb(255 254 249 / 0.6);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 11px;
}
.document-compliance li.exceeded {
  background: #fbe9cf;
}
.document-numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding: 20px 0;
  margin: 24px 0;
  gap: 16px;
}
.document-numbers span,
.document-numbers small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.document-numbers strong {
  display: block;
  font-size: 28px;
  font-weight: 500;
  margin: 8px 0;
}
.document-notes {
  margin: 20px 0;
  font-size: 11px;
  line-height: 1.8;
  white-space: pre-wrap;
}
.document-notes h3 {
  font-size: 12px;
}
@media (max-width: 600px) {
  .document-sheet {
    padding: 20px;
  }
  .document-numbers {
    grid-template-columns: 1fr;
  }
}
</style>
