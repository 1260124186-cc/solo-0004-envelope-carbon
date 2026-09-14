<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { scanStoredData, capacityLimits, nearLimitRatio, staleEditingDays } from './inspect'
import { date } from '../shared/format'

const report = shallowRef(scanStoredData())
const errors = computed(() => report.value.findings.filter((item) => item.severity === 'error'))
const warnings = computed(() => report.value.findings.filter((item) => item.severity === 'warning'))
const layerNearLimit = Math.ceil(capacityLimits.layers * nearLimitRatio)
const nearPercent = Math.round(nearLimitRatio * 100)

function recheck() {
  report.value = scanStoredData()
}
</script>

<template>
  <section class="panel selfcheck">
    <div class="section-heading">
      <div>
        <span class="eyebrow">数据自检</span>
        <h1>先定位问题，再动手修复。</h1>
      </div>
      <button
        class="button"
        @click="recheck"
      >
        重新自检
      </button>
    </div>
    <p class="section-intro">
      只读扫描浏览器中保存的全部构造、材料与计算书，不修改任何数据。同一类不一致始终按同一固定规则分类：导致设计无法载入或破坏计算书冻结链的列为错误，其余仅作提醒。
    </p>
    <div class="selfcheck-summary">
      <div>
        <span>扫描记录</span>
        <strong v-if="report.counts">
          {{ report.counts.assemblies }} · {{ report.counts.materials }} ·
          {{ report.counts.documents }}
        </strong>
        <strong v-else>无法读取</strong>
        <small>构造 · 材料 · 计算书</small>
      </div>
      <div>
        <span>必须处理的错误</span>
        <strong
          class="count-error"
          data-check="selfcheck-error-count"
          >{{ errors.length }}</strong
        >
        <small>阻碍载入、计算或定稿</small>
      </div>
      <div>
        <span>仅提醒的警告</span>
        <strong
          class="count-warning"
          data-check="selfcheck-warning-count"
          >{{ warnings.length }}</strong
        >
        <small>不妨碍使用，建议关注</small>
      </div>
    </div>
    <p class="selfcheck-meta">
      上次自检：{{ date(report.checkedAt) }}
      <template v-if="!report.stored">· 浏览器中还没有保存的设计，当前为内置示例</template>
    </p>
    <div
      v-if="!report.findings.length"
      class="empty-state"
    >
      <h2>数据状态良好</h2>
      <p>未发现悬空材料引用、容量风险、长期未定稿的构造或计算书差异。</p>
    </div>
    <section
      v-if="errors.length"
      class="finding-group"
      aria-label="必须处理的错误"
    >
      <h2>必须处理的错误（{{ errors.length }}）</h2>
      <ul class="finding-list">
        <li
          v-for="(item, index) in errors"
          :key="`error-${index}`"
          class="finding error"
        >
          <strong>{{ item.subject }}</strong>
          <p>{{ item.text }}</p>
          <small>影响：{{ item.impact }}</small>
        </li>
      </ul>
    </section>
    <section
      v-if="warnings.length"
      class="finding-group"
      aria-label="仅提醒的警告"
    >
      <h2>仅提醒的警告（{{ warnings.length }}）</h2>
      <ul class="finding-list">
        <li
          v-for="(item, index) in warnings"
          :key="`warning-${index}`"
          class="finding warning"
        >
          <strong>{{ item.subject }}</strong>
          <p>{{ item.text }}</p>
          <small>影响：{{ item.impact }}</small>
        </li>
      </ul>
    </section>
    <details class="selfcheck-rules">
      <summary>固定的分类规则</summary>
      <ul>
        <li>
          错误（必须处理）：存储无法解析、标识缺失或重复、材料或构造参数无效、构造层引用不存在的材料、集合超过容量上限（构造
          {{ capacityLimits.assemblies }} 个、材料 {{ capacityLimits.materials }} 种、计算书
          {{ capacityLimits.documents }} 份、单构造 {{ capacityLimits.layers }}
          层）、计算书与冻结构造或其冻结结果不一致。
        </li>
        <li>
          警告（仅提醒）：集合数量达到容量 {{ nearPercent }}% 及以上、单构造层数达到
          {{ layerNearLimit }} 层及以上、构造编辑中超过 {{ staleEditingDays }}
          天且从未定稿、计算书关联的构造已不存在。
        </li>
        <li>计算书与当前构造之间的差异属于正常的重新编辑流程，不计为问题。</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.selfcheck {
  max-width: 1100px;
  margin: 0 auto;
}
.selfcheck-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-block: 1px solid var(--line);
  padding: 20px 0;
  margin-bottom: 8px;
  gap: 16px;
}
.selfcheck-summary span,
.selfcheck-summary small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.selfcheck-summary strong {
  display: block;
  font-size: 28px;
  font-weight: 500;
  margin: 8px 0;
}
.selfcheck-summary .count-error {
  color: #922f20;
}
.selfcheck-summary .count-warning {
  color: #73581e;
}
.selfcheck-meta {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 24px;
}
.finding-group {
  margin-bottom: 28px;
}
.finding-group h2 {
  margin-bottom: 12px;
}
.finding-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.finding {
  border: 1px solid;
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.8;
}
.finding strong {
  display: block;
  font-size: 12px;
}
.finding p {
  margin: 6px 0;
}
.finding small {
  color: var(--muted);
  font-size: 11px;
}
.finding.error {
  background: #fff0eb;
  border-color: #eacac0;
  color: #922f20;
}
.finding.warning {
  background: #fff8e7;
  border-color: #e5d7af;
  color: #73581e;
}
.finding.error strong,
.finding.warning strong {
  color: var(--ink);
}
.selfcheck-rules {
  border-top: 1px solid var(--line);
  padding-top: 18px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.9;
}
.selfcheck-rules summary {
  cursor: pointer;
  color: var(--green);
  font-weight: 600;
}
.selfcheck-rules ul {
  margin: 12px 0 0;
  padding-left: 20px;
}
@media (max-width: 600px) {
  .selfcheck-summary {
    grid-template-columns: 1fr;
  }
}
</style>
