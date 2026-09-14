<script setup lang="ts">
import type { Layer } from './types'
import type { Material } from '../materials/types'
import type { ThicknessUnit } from '../shared/thickness'
import { thicknessUnitLabels } from '../shared/thickness'
import LayerRow from './LayerRow.vue'
import MaterialPicker from '../materials/MaterialPicker.vue'
defineProps<{ layers: Layer[]; materials: Material[]; disabled: boolean; unit: ThicknessUnit }>()
const emit = defineEmits<{
  update: [id: string, patch: Partial<Layer>]
  remove: [id: string]
  move: [id: string, direction: -1 | 1]
  add: [material: Material]
  'update:unit': [unit: ThicknessUnit]
}>()
const units: ThicknessUnit[] = ['mm', 'm']
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
      <div class="heading-side">
        <div
          class="unit-toggle"
          role="group"
          aria-label="厚度单位"
        >
          <button
            v-for="option in units"
            :key="option"
            type="button"
            :class="{ active: unit === option }"
            :aria-pressed="unit === option"
            @click="emit('update:unit', option)"
          >
            {{ thicknessUnitLabels[option] }}
          </button>
        </div>
        <span class="muted">{{ layers.length }} / 20 层</span>
      </div>
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
      :unit="unit"
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
.heading-side {
  display: flex;
  align-items: center;
  gap: 14px;
}
.unit-toggle {
  display: flex;
  border: 1px solid #cfd8ca;
  border-radius: 4px;
  overflow: hidden;
}
.unit-toggle button {
  border: 0;
  background: var(--paper);
  color: var(--muted);
  padding: 6px 12px;
  font-size: 11px;
}
.unit-toggle button + button {
  border-left: 1px solid #cfd8ca;
}
.unit-toggle button.active {
  background: var(--green);
  color: white;
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
