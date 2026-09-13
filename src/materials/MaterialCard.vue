<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from './types'
import { kindLabels, kindColors } from './types'
import { latestRevision, sortedRevisions } from './revisions'
import { number, date } from '../shared/format'
const props = defineProps<{ material: Material; assemblies: Assembly[]; busy: boolean }>()
const emit = defineEmits<{ revise: [id: string] }>()
const latest = computed(() => latestRevision(props.material))
const history = computed(() => sortedRevisions(props.material))
const usage = computed(() => {
  const byRevision = new Map<number, string[]>()
  for (const assembly of props.assemblies) {
    for (const layer of assembly.layers) {
      if (layer.materialId !== props.material.id) continue
      const names = byRevision.get(layer.materialRevision) ?? []
      if (!names.includes(assembly.name)) names.push(assembly.name)
      byRevision.set(layer.materialRevision, names)
    }
  }
  return [...byRevision.entries()].sort((a, b) => b[0] - a[0])
})
</script>

<template>
  <section
    class="material-card"
    :style="{ borderTopColor: kindColors[material.kind] }"
  >
    <div class="card-topline">
      <span>{{ kindLabels[material.kind] }}</span
      ><span>{{ material.custom ? '自定义物性' : '教学示例' }}</span>
    </div>
    <div class="card-title">
      <h2>{{ material.name }}</h2>
      <span class="version-badge">版本 {{ latest.revision }}</span>
    </div>
    <p class="material-description">{{ material.description || '无补充说明。' }}</p>
    <dl class="material-properties">
      <div>
        <dt>密度</dt>
        <dd>{{ number(latest.density) }} <small>千克/立方米</small></dd>
      </div>
      <div>
        <dt>导热系数</dt>
        <dd>{{ number(latest.conductivity) }} <small>瓦/米·开尔文</small></dd>
      </div>
      <div>
        <dt>碳因子</dt>
        <dd>{{ number(latest.factor) }} <small>千克当量/千克</small></dd>
      </div>
      <div>
        <dt>参考寿命</dt>
        <dd>{{ latest.lifespan }} <small>年</small></dd>
      </div>
    </dl>
    <p class="material-source">{{ latest.source }} · 修订于 {{ date(latest.createdAt) }}</p>
    <details class="revision-history">
      <summary>修订记录（{{ history.length }}）</summary>
      <ol>
        <li
          v-for="revision in history"
          :key="revision.revision"
        >
          <strong>版本 {{ revision.revision }}</strong>
          <span v-if="revision.revision === latest.revision">（当前版本）</span>
          · {{ date(revision.createdAt) }}<br />
          {{ revision.source }}<template v-if="revision.note"> · {{ revision.note }}</template>
        </li>
      </ol>
    </details>
    <div class="revision-usage">
      <h3>构造引用</h3>
      <p v-if="!usage.length">尚无构造引用此材料。</p>
      <p
        v-for="[revision, names] in usage"
        :key="revision"
      >
        版本 {{ revision }}：{{ names.join('、') }}
      </p>
    </div>
    <button
      v-if="material.custom"
      class="button small"
      :disabled="busy"
      @click="emit('revise', material.id)"
    >
      修订物性
    </button>
  </section>
</template>

<style scoped>
.material-card {
  border: 1px solid var(--line);
  border-top: 3px solid;
  border-radius: 5px;
  padding: 20px;
  background: var(--paper);
}
.card-topline {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--muted);
}
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 15px 0 8px;
}
.material-card h2 {
  margin: 0;
  font-size: 18px;
}
.version-badge {
  font-size: 10px;
  color: var(--green);
  background: var(--green-pale);
  padding: 4px 8px;
  white-space: nowrap;
}
.material-description {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
  min-height: 38px;
}
.material-properties {
  margin: 20px 0;
}
.material-properties div {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin: 12px 0;
}
.material-properties dt {
  color: var(--muted);
}
.material-properties dd {
  margin: 0;
}
.material-properties small {
  font-size: 9px;
  color: var(--muted);
}
.material-source {
  font-size: 10px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  color: var(--muted);
}
.revision-history {
  font-size: 10px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-top: 12px;
}
.revision-history summary {
  cursor: pointer;
}
.revision-history ol {
  padding-left: 18px;
  margin: 10px 0 0;
  line-height: 1.8;
}
.revision-history strong {
  color: var(--ink);
  font-weight: 500;
}
.revision-usage {
  font-size: 10px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-top: 12px;
  margin-bottom: 14px;
}
.revision-usage h3 {
  font-size: 10px;
  margin: 0 0 6px;
  color: var(--ink);
}
.revision-usage p {
  margin: 4px 0;
  line-height: 1.7;
}
</style>
