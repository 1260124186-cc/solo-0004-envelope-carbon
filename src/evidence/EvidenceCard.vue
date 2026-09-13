<script setup lang="ts">
import type { Evidence, EvidenceStatus } from './types'
import { propertyLabels, statusLabels, statusOrder } from './types'
import type { Material } from '../materials/types'
const props = defineProps<{
  evidence: Evidence
  materials: Material[]
  busy: boolean
  usedCount: number
}>()
const emit = defineEmits<{ setStatus: [id: string, status: EvidenceStatus] }>()
function materialName(id: string): string {
  return props.materials.find((material) => material.id === id)?.name ?? '已删除材料'
}
</script>

<template>
  <article
    class="evidence-card"
    :class="`status-${evidence.status}`"
    :data-check="`evidence-card-${evidence.status}`"
  >
    <div class="card-head">
      <div>
        <span class="status-badge">{{ statusLabels[evidence.status] }}</span>
        <h2>{{ evidence.title }}</h2>
      </div>
      <span class="evidence-year">{{ evidence.year }} 年</span>
    </div>
    <p
      v-if="evidence.url"
      class="evidence-url"
    >
      <a
        :href="evidence.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ evidence.url }}
      </a>
    </p>
    <p
      v-else
      class="muted no-url"
    >
      未登记来源网址
    </p>
    <dl class="evidence-meta">
      <div>
        <dt>适用材料范围</dt>
        <dd>{{ evidence.scope }}</dd>
      </div>
      <div v-if="evidence.note">
        <dt>补充说明</dt>
        <dd>{{ evidence.note }}</dd>
      </div>
    </dl>
    <div class="evidence-links">
      <h3>关联物性（{{ evidence.links.length }} 种材料）</h3>
      <ul>
        <li
          v-for="link in evidence.links"
          :key="link.materialId"
        >
          <strong>{{ materialName(link.materialId) }}</strong>
          <span>{{ link.properties.map((key) => propertyLabels[key]).join('、') }}</span>
        </li>
      </ul>
    </div>
    <p
      v-if="usedCount"
      class="usage-note"
    >
      当前有
      {{ usedCount }}
      个构造引用了关联材料；标为「不再适用」后这些构造会收到提示，但计算结果与历史计算书不变。
    </p>
    <div class="card-actions">
      <label class="status-select"
        >状态
        <select
          :value="evidence.status"
          data-check="evidence-status-select"
          :disabled="busy"
          :aria-label="`修改《${evidence.title}》的核实状态`"
          @change="
            emit(
              'setStatus',
              evidence.id,
              ($event.target as HTMLSelectElement).value as EvidenceStatus,
            )
          "
        >
          <option
            v-for="status in statusOrder"
            :key="status"
            :value="status"
          >
            {{ statusLabels[status] }}
          </option>
        </select>
      </label>
    </div>
  </article>
</template>

<style scoped>
.evidence-card {
  border: 1px solid var(--line);
  border-left: 4px solid #b9a95f;
  border-radius: 6px;
  background: var(--paper);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.evidence-card.status-verified {
  border-left-color: var(--green);
}
.evidence-card.status-obsolete {
  border-left-color: #a34f3a;
  background: #fdf8f3;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.card-head h2 {
  margin: 8px 0 0;
  font-size: 16px;
}
.evidence-year {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.status-badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
  background: #f0e9cf;
  color: #7a6422;
}
.status-verified .status-badge {
  background: var(--green-pale);
  color: var(--green);
}
.status-obsolete .status-badge {
  background: #f6e0d7;
  color: #8f452f;
}
.evidence-url {
  margin: 0;
  font-size: 11px;
  word-break: break-all;
}
.evidence-url a {
  color: var(--green);
}
.no-url {
  font-size: 11px;
  margin: 0;
}
.evidence-meta {
  margin: 0;
  font-size: 11px;
}
.evidence-meta dt {
  color: var(--muted);
  margin-bottom: 3px;
}
.evidence-meta dd {
  margin: 0 0 8px;
  line-height: 1.7;
}
.evidence-links h3 {
  font-size: 11px;
  margin: 0 0 6px;
}
.evidence-links ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.evidence-links li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  border-bottom: 1px dotted var(--line);
  padding-bottom: 6px;
}
.evidence-links li span {
  color: var(--muted);
  text-align: right;
}
.usage-note {
  font-size: 10px;
  color: #865629;
  background: #fcf3de;
  padding: 8px 10px;
  border-radius: 4px;
  margin: 0;
  line-height: 1.7;
}
.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}
.status-select {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.status-select select {
  width: auto;
  padding: 7px 10px;
  font-size: 11px;
}
</style>
