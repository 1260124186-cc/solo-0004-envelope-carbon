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
  canUndo: boolean
  canRedo: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<Assembly>, field?: string]
  updateLayer: [id: string, patch: Partial<Layer>, field?: string]
  removeLayer: [id: string]
  moveLayer: [id: string, direction: -1 | 1]
  addLayer: [material: Material]
  undo: []
  redo: []
  save: []
  reopen: []
  finalize: []
}>()
</script>

<template>
  <div class="design-grid">
    <section class="design-surface">
      <div class="section-heading">
        <div>
          <span class="eyebrow">设计条件</span>
          <h1>让每一层，都有依据。</h1>
        </div>
        <span class="state-label">{{ stateLabels[assembly.state] }}</span>
      </div>
      <p class="section-intro">定义构造、校核物性，在材料选择中看见减碳的可能。</p>
      <AssemblyFields
        :assembly="assembly"
        :disabled="busy || assembly.state === 'finalized'"
        @update="(patch, field) => emit('update', patch, field)"
      />
      <LayerEditor
        :layers="assembly.layers"
        :materials="materials"
        :disabled="busy || assembly.state === 'finalized'"
        @update="(id, patch, field) => emit('updateLayer', id, patch, field)"
        @remove="emit('removeLayer', $event)"
        @move="(id, direction) => emit('moveLayer', id, direction)"
        @add="emit('addLayer', $event)"
      />
      <div class="design-footer">
        <div class="history-tools">
          <span class="save-indicator">{{
            busy ? '正在保存…' : dirty ? '有未保存的修改' : `已保存 · 修订 ${assembly.revision}`
          }}</span>
          <div
            class="history-buttons"
            role="group"
            aria-label="编辑历史"
          >
            <button
              type="button"
              class="button small"
              :disabled="busy || assembly.state === 'finalized' || !canUndo"
              :title="assembly.state === 'finalized' ? '已定稿构造不可撤销' : '撤销（Ctrl/⌘ + Z）'"
              @click="emit('undo')"
            >
              ↶ 撤销
            </button>
            <button
              type="button"
              class="button small"
              :disabled="busy || assembly.state === 'finalized' || !canRedo"
              :title="assembly.state === 'finalized' ? '已定稿构造不可重做' : '重做（Ctrl/⌘ + Y）'"
              @click="emit('redo')"
            >
              ↷ 重做
            </button>
          </div>
        </div>
        <div class="actions">
          <template v-if="assembly.state === 'editing'">
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
.history-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.history-buttons {
  display: flex;
  gap: 6px;
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
