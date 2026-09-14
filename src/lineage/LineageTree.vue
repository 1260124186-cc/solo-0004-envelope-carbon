<script setup lang="ts">
import type { LineageNode } from './lineage'
import { stateLabels } from '../assemblies/types'
import { date } from '../shared/format'

defineProps<{ node: LineageNode; focusId: string }>()
const emit = defineEmits<{ open: [id: string] }>()
</script>

<template>
  <li class="lineage-item">
    <div
      class="lineage-card"
      :class="{ focus: node.assembly.id === focusId }"
      data-check="lineage-card"
    >
      <div class="lineage-card-head">
        <strong>{{ node.assembly.name }}</strong>
        <span class="state-label">{{ stateLabels[node.assembly.state] }}</span>
      </div>
      <p class="lineage-meta">
        修订 {{ node.assembly.revision }} · {{ date(node.assembly.updatedAt)
        }}<template v-if="node.descendants"> · 下游 {{ node.descendants }} 项</template>
      </p>
      <p
        v-if="node.assembly.origin"
        class="lineage-origin"
      >
        复制自「{{ node.assembly.origin.name }}」<template v-if="node.sourceNote"
          >（{{ node.sourceNote }}）</template
        >
      </p>
      <ul
        v-if="node.differences.length"
        class="lineage-diff"
      >
        <li
          v-for="difference in node.differences"
          :key="difference"
        >
          {{ difference }}
        </li>
      </ul>
      <p
        v-else-if="node.source"
        class="lineage-note"
      >
        与来源构造内容一致，暂无关键差异。
      </p>
      <p
        v-else-if="!node.assembly.origin"
        class="lineage-note"
      >
        基准构造，无派生来源。
      </p>
      <button
        class="button small"
        @click="emit('open', node.assembly.id)"
      >
        在编辑区打开
      </button>
    </div>
    <ul
      v-if="node.children.length"
      class="lineage-children"
    >
      <LineageTree
        v-for="child in node.children"
        :key="child.assembly.id"
        :node="child"
        :focus-id="focusId"
        @open="emit('open', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.lineage-item {
  list-style: none;
}
.lineage-card {
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 6px;
  padding: 14px 16px;
  display: grid;
  gap: 8px;
  justify-items: start;
}
.lineage-card.focus {
  border-color: var(--green);
  background: var(--green-pale);
}
.lineage-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.state-label {
  color: var(--green);
  background: var(--green-pale);
  font-size: 11px;
  padding: 3px 8px;
  white-space: nowrap;
}
.lineage-card.focus .state-label {
  background: var(--paper);
}
.lineage-meta,
.lineage-origin,
.lineage-note {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
}
.lineage-diff {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.9;
}
.lineage-children {
  margin: 12px 0 12px 18px;
  padding-left: 18px;
  border-left: 2px solid var(--line);
  display: grid;
  gap: 12px;
}
</style>
