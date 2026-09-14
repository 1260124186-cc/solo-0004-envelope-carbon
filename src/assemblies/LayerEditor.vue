<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Layer, LayerBatchPatch } from './types'
import type { Material } from '../materials/types'
import LayerRow from './LayerRow.vue'
import LayerBatchPanel from './LayerBatchPanel.vue'
import MaterialPicker from '../materials/MaterialPicker.vue'
const props = defineProps<{ layers: Layer[]; materials: Material[]; disabled: boolean }>()
const emit = defineEmits<{
  update: [id: string, patch: Partial<Layer>]
  remove: [id: string]
  move: [id: string, direction: -1 | 1]
  add: [material: Material]
  batchUpdate: [ids: string[], patch: LayerBatchPatch]
}>()
const selectedIds = ref<string[]>([])
const selectedTargets = computed(() =>
  props.layers
    .map((layer, index) => ({ layer, index }))
    .filter((target) => selectedIds.value.includes(target.layer.id)),
)
function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}
function selectAll() {
  selectedIds.value = props.layers.map((layer) => layer.id)
}
function applyBatch(patch: LayerBatchPatch) {
  emit(
    'batchUpdate',
    selectedTargets.value.map((target) => target.layer.id),
    patch,
  )
  selectedIds.value = []
}
</script>

<template>
  <section
    class="layer-editor"
    aria-labelledby="layer-heading"
  >
    <div class="section-heading">
      <div>
        <span class="eyebrow">构造组成</span>
        <h2 id="layer-heading">从室外，到室内</h2>
      </div>
      <span class="muted">{{ layers.length }} / 20 层</span>
    </div>
    <p class="layer-direction">室外侧 <span>↓ 材料按实际构造顺序排列</span></p>
    <div
      v-if="!layers.length"
      class="empty-state"
    >
      构造还是空的。请从下方选择第一种材料。
    </div>
    <div
      v-if="layers.length && !disabled"
      class="selection-bar"
    >
      <span class="muted">已选 {{ selectedTargets.length }} 层</span>
      <button
        type="button"
        class="button small"
        :disabled="selectedTargets.length === layers.length"
        @click="selectAll"
      >
        全选
      </button>
      <button
        type="button"
        class="button small"
        :disabled="!selectedTargets.length"
        @click="selectedIds = []"
      >
        清除选择
      </button>
    </div>
    <LayerRow
      v-for="(layer, index) in layers"
      :key="layer.id"
      :layer="layer"
      :index="index"
      :total="layers.length"
      :materials="materials"
      :disabled="disabled"
      :selected="selectedIds.includes(layer.id)"
      @update="emit('update', layer.id, $event)"
      @remove="emit('remove', layer.id)"
      @move="emit('move', layer.id, $event)"
      @toggle-select="toggle(layer.id)"
    />
    <p
      v-if="layers.length"
      class="layer-direction"
    >
      室内侧
    </p>
    <LayerBatchPanel
      v-if="selectedTargets.length && !disabled"
      :targets="selectedTargets"
      :materials="materials"
      :disabled="disabled"
      @apply="applyBatch"
      @cancel="selectedIds = []"
    />
    <MaterialPicker
      :materials="materials"
      :disabled="disabled || layers.length >= 20"
      @add="emit('add', $event)"
    />
  </section>
</template>

<style scoped>
.layer-editor {
  margin-top: 30px;
}
.layer-direction {
  font-size: 11px;
  color: var(--muted);
  margin: 15px 0;
}
.layer-direction span {
  margin-left: 12px;
  color: #9a9d94;
}
.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 11px;
}
.selection-bar .muted {
  margin-right: auto;
}
</style>
