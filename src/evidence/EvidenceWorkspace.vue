<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { Evidence, EvidenceStatus } from './types'
import { statusLabels, statusOrder } from './types'
import EvidenceCard from './EvidenceCard.vue'
import EvidenceForm from './EvidenceForm.vue'
const props = defineProps<{
  evidence: Evidence[]
  materials: Material[]
  assemblies: Assembly[]
  busy: boolean
  presetMaterialId?: string
  saveEvidence: (evidence: Evidence) => Promise<boolean>
  setStatus: (id: string, status: EvidenceStatus) => Promise<boolean>
}>()
const showForm = shallowRef(false)
const statusFilter = shallowRef<EvidenceStatus | ''>('')
const query = shallowRef('')

watch(
  () => props.presetMaterialId,
  (id) => {
    if (id) {
      showForm.value = true
      statusFilter.value = ''
      query.value = ''
    }
  },
  { immediate: true },
)

function usedCount(item: Evidence): number {
  const linked = new Set(item.links.map((link) => link.materialId))
  const assemblies = new Set(
    props.assemblies
      .filter((assembly) => assembly.layers.some((layer) => linked.has(layer.materialId)))
      .map((assembly) => assembly.id),
  )
  return assemblies.size
}

const visible = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  const nameOf = (id: string) => props.materials.find((material) => material.id === id)?.name ?? ''
  return props.evidence.filter((item) => {
    if (statusFilter.value && item.status !== statusFilter.value) return false
    if (!needle) return true
    const haystack = [
      item.title,
      item.year,
      item.scope,
      item.note,
      item.url,
      ...item.links.map((link) => nameOf(link.materialId)),
    ]
      .join(' ')
      .toLocaleLowerCase()
    return haystack.includes(needle)
  })
})

const statusCounts = computed(() => {
  const counts: Record<EvidenceStatus, number> = { pending: 0, verified: 0, obsolete: 0 }
  for (const item of props.evidence) counts[item.status] += 1
  return counts
})
</script>

<template>
  <section class="evidence-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">物性依据</span>
        <h1>资料出处，单独登记、集中核对。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy"
        @click="showForm = !showForm"
      >
        {{ showForm ? '收起表单' : '＋ 登记依据' }}
      </button>
    </div>
    <p class="section-intro">
      依据只记录资料名称、年份、来源网址、适用材料范围与补充说明，并关联现有材料的一项或多项物性。登记依据不会自动改写材料数值；标为「不再适用」后，引用它的构造会收到明确提示，计算结果与历史计算书保持不变。
    </p>

    <EvidenceForm
      v-if="showForm"
      :busy="busy"
      :materials="materials"
      :preset-material-id="presetMaterialId"
      :submit-evidence="saveEvidence"
      @cancel="showForm = false"
    />

    <div class="evidence-filters">
      <label class="search-label"
        >搜索依据<input
          v-model="query"
          type="search"
          placeholder="资料名称、范围或关联材料"
      /></label>
      <label
        >核实状态
        <select
          v-model="statusFilter"
          data-check="evidence-status-filter"
        >
          <option value="">全部状态</option>
          <option
            v-for="status in statusOrder"
            :key="status"
            :value="status"
          >
            {{ statusLabels[status] }}（{{ statusCounts[status] }}）
          </option>
        </select>
      </label>
      <span class="muted count">{{ visible.length }} / {{ evidence.length }} 条依据</span>
    </div>

    <div
      v-if="visible.length"
      class="evidence-grid"
    >
      <EvidenceCard
        v-for="item in visible"
        :key="item.id"
        :evidence="item"
        :materials="materials"
        :busy="busy"
        :used-count="usedCount(item)"
        @set-status="setStatus"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      <template v-if="evidence.length">没有符合筛选条件的依据。</template>
      <template v-else>
        <h2>还没有物性依据</h2>
        <p>点击「登记依据」，把物性参数对应的资料出处和适用条件记录下来。</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.evidence-workspace {
  max-width: 1200px;
  margin: 0 auto;
}
.evidence-filters {
  display: flex;
  gap: 16px;
  align-items: end;
  margin: 8px 0 24px;
}
.search-label {
  flex: 1;
  max-width: 440px;
}
.evidence-filters .count {
  margin-left: auto;
  padding-bottom: 12px;
  font-size: 11px;
}
.evidence-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}
@media (max-width: 900px) {
  .evidence-grid {
    grid-template-columns: 1fr;
  }
  .evidence-filters {
    flex-direction: column;
    align-items: stretch;
  }
  .evidence-filters .count {
    margin-left: 0;
  }
}
</style>
