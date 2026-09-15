<script setup lang="ts">
import type { Assembly, Layer, Finding } from './types'
import type { Material } from '../materials/types'
import type { Calculation } from '../carbon/types'
import AssemblyFields from './AssemblyFields.vue'
import LayerEditor from './LayerEditor.vue'
import CalculationPanel from '../carbon/CalculationPanel.vue'
import { stateLabels } from './types'
defineProps<{
  assembly: Assembly
  materials: Material[]
  result: Calculation | null
  findings: Finding[]
  busy: boolean
  dirty: boolean
  archived?: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<Assembly>]
  updateLayer: [id: string, patch: Partial<Layer>]
  removeLayer: [id: string]
  moveLayer: [id: string, direction: -1 | 1]
  addLayer: [material: Material]
  save: []
  reopen: []
  finalize: []
  restore: []
}>()
</script>

<template>
  <div class="design-grid">
    <section class="design-surface">
      <p
        v-if="archived"
        class="inline-warning"
      >
        这是已归档构造：已从当前列表与方案比较中隐藏，但内容完整保留。归档期间不可编辑，定稿构造仍保持只读；恢复后按原身份回到工作列表。
      </p>
      <div class="section-heading">
        <div>
          <span class="eyebrow">设计条件</span>
          <h1>让每一层，都有依据。</h1>
        </div>
        <span class="state-label"
          >{{ stateLabels[assembly.state] }}{{ archived ? ' · 已归档' : '' }}</span
        >
      </div>
      <p class="section-intro">定义构造、校核物性，在材料选择中看见减碳的可能。</p>
      <AssemblyFields
        :assembly="assembly"
        :disabled="busy || archived || assembly.state === 'finalized'"
        @update="emit('update', $event)"
      />
      <LayerEditor
        :layers="assembly.layers"
        :materials="materials"
        :disabled="busy || archived || assembly.state === 'finalized'"
        @update="(id, patch) => emit('updateLayer', id, patch)"
        @remove="emit('removeLayer', $event)"
        @move="(id, direction) => emit('moveLayer', id, direction)"
        @add="emit('addLayer', $event)"
      />
      <div class="design-footer">
        <span class="save-indicator">{{
          archived
            ? '已归档：从列表隐藏，未被删除'
            : busy
              ? '正在保存…'
              : dirty
                ? '有未保存的修改'
                : `已保存 · 修订 ${assembly.revision}`
        }}</span>
        <div class="actions">
          <button
            v-if="archived"
            class="button primary"
            :disabled="busy"
            @click="emit('restore')"
          >
            恢复到当前列表
          </button>
          <template v-else-if="assembly.state === 'editing'">
            <button
              class="button"
              :disabled="busy || dirty || !result"
              @click="emit('finalize')"
            >
              生成定稿
            </button>
            <button
              class="button primary"
              :disabled="busy || !dirty || !result"
              @click="emit('save')"
            >
              保存构造
            </button>
          </template>
          <button
            v-else
            class="button primary"
            :disabled="busy"
            @click="emit('reopen')"
          >
            重新开启编辑
          </button>
        </div>
      </div>
    </section>
    <CalculationPanel
      :result="result"
      :findings="findings"
      :area="assembly.area"
      :years="assembly.years"
      :carbon-limit="assembly.carbonLimit"
      :thermal-limit="assembly.thermalLimit"
    />
  </div>
</template>

<style scoped>
.design-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 355px;
  gap: 28px;
  align-items: start;
}
.design-surface {
  background: var(--paper);
  border: 1px solid var(--line);
  padding: 28px;
  border-radius: 8px;
}
.state-label {
  color: var(--green);
  background: var(--green-pale);
  font-size: 11px;
  padding: 5px 9px;
  white-space: nowrap;
}
.design-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  margin-top: 24px;
  padding-top: 20px;
  gap: 12px;
}
.save-indicator {
  font-size: 11px;
  color: var(--muted);
}
@media (max-width: 1000px) {
  .design-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .design-surface {
    padding: 18px;
  }
  .design-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
