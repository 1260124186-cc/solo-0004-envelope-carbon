<script setup lang="ts">
import type { Material } from '../materials/types'
import type { Evidence, PropertyKey } from '../evidence/types'
import { propertyLabels, statusLabels } from '../evidence/types'
const props = defineProps<{
  material: Material
  evidence: Evidence[]
}>()
defineEmits<{ register: [materialId: string] }>()

interface EvidenceRow {
  evidence: Evidence
  properties: PropertyKey[]
}
const rows: EvidenceRow[] = props.evidence
  .map((evidence) => {
    const link = evidence.links.find((item) => item.materialId === props.material.id)
    return link ? { evidence, properties: link.properties } : null
  })
  .filter((row): row is EvidenceRow => row !== null)
</script>

<template>
  <div class="material-evidence">
    <div class="evidence-heading">
      <span>物性依据（{{ rows.length }}）</span>
      <button
        type="button"
        class="register-link"
        @click="$emit('register', material.id)"
      >
        ＋ 登记依据
      </button>
    </div>
    <ul
      v-if="rows.length"
      class="evidence-list"
    >
      <li
        v-for="row in rows"
        :key="row.evidence.id"
        :class="`is-${row.evidence.status}`"
      >
        <span class="evidence-name">
          <a
            v-if="row.evidence.url"
            :href="row.evidence.url"
            target="_blank"
            rel="noopener noreferrer"
            >《{{ row.evidence.title }}》</a
          >
          <template v-else>《{{ row.evidence.title }}》</template>
          <small>{{ row.evidence.year }}</small>
        </span>
        <span class="evidence-props">{{
          row.properties.map((key) => propertyLabels[key]).join('、')
        }}</span>
        <span
          class="evidence-status"
          :class="`is-${row.evidence.status}`"
          >{{ statusLabels[row.evidence.status] }}</span
        >
      </li>
    </ul>
    <p
      v-else
      class="muted evidence-empty"
    >
      尚未登记依据；材料数值不会因登记依据而改变。
    </p>
  </div>
</template>

<style scoped>
.material-evidence {
  margin-top: 12px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.evidence-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: var(--muted);
}
.register-link {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--green);
  font-size: 10px;
}
.evidence-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.evidence-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 10px;
  line-height: 1.5;
  padding-left: 8px;
  border-left: 2px solid #b9a95f;
}
.evidence-list li.is-verified {
  border-left-color: var(--green);
}
.evidence-list li.is-obsolete {
  border-left-color: #a34f3a;
}
.evidence-name {
  flex: 1;
  min-width: 0;
}
.evidence-name a {
  color: var(--ink);
}
.evidence-name small {
  color: var(--muted);
  margin-left: 3px;
}
.evidence-props {
  color: var(--muted);
  white-space: nowrap;
}
.evidence-status {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #f0e9cf;
  color: #7a6422;
  white-space: nowrap;
}
.evidence-status.is-verified {
  background: var(--green-pale);
  color: var(--green);
}
.evidence-status.is-obsolete {
  background: #f6e0d7;
  color: #8f452f;
}
.evidence-empty {
  font-size: 10px;
  margin: 8px 0 0;
}
</style>
