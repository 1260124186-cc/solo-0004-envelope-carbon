<script setup lang="ts">
import type { Layer } from './types'
import type { Material } from '../materials/types'
import LayerRow from './LayerRow.vue'
import MaterialPicker from '../materials/MaterialPicker.vue'
defineProps<{ layers: Layer[]; materials: Material[]; disabled: boolean }>()
const emit = defineEmits<{
  update: [id: string, patch: Partial<Layer>]
  remove: [id: string]
  move: [id: string, direction: -1 | 1]
  add: [material: Material]
}>()
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
    <LayerRow
      v-for="(layer, index) in layers"
      :key="layer.id"
      :layer="layer"
      :index="index"
      :total="layers.length"
      :materials="materials"
      :disabled="disabled"
      @update="emit('update', layer.id, $event)"
      @remove="emit('remove', layer.id)"
      @move="emit('move', layer.id, $event)"
    />
    <p
      v-if="layers.length"
      class="layer-direction"
    >
      室内侧
    </p>
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
</style>
