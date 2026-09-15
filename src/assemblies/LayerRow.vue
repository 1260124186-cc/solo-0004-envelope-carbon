<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from './types'
import type { Material } from '../materials/types'
import { kindColors, kindLabels } from '../materials/types'
import { number } from '../shared/format'
const props = defineProps<{
  layer: Layer
  index: number
  total: number
  materials: Material[]
  disabled: boolean
  dragging?: boolean
  dropBefore?: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<Layer>]
  remove: []
  move: [direction: -1 | 1]
  dragstart: [event: DragEvent]
}>()
const material = computed(() => props.materials.find((item) => item.id === props.layer.materialId))
function changeMaterial(event: Event) {
  const selected = props.materials.find(
    (item) => item.id === (event.target as HTMLSelectElement).value,
  )
  if (selected) emit('update', { materialId: selected.id, lifespan: selected.lifespan })
}
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
function onDragStart(event: DragEvent) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  emit('dragstart', event)
}
</script>

<template>
  <fieldset
    class="layer-row"
    :class="{ dragging, 'drop-before': dropBefore }"
    :disabled="disabled"
    :aria-label="`第 ${index + 1} 层`"
  >
    <legend class="sr-only">第 {{ index + 1 }} 层</legend>
    <div
      class="layer-ordinal"
      :style="{ borderColor: material ? kindColors[material.kind] : '#aaa' }"
    >
      {{ String(index + 1).padStart(2, '0') }}
    </div>
    <div class="layer-main">
      <div class="layer-title-row">
        <label class="material-select"
          >材料
          <select
            :value="layer.materialId"
            :aria-label="`第 ${index + 1} 层材料`"
            @change="changeMaterial"
          >
            <option
              v-for="item in materials"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </label>
        <span
          v-if="material"
          class="material-kind"
          >{{ kindLabels[material.kind] }}</span
        >
        <div class="layer-actions">
          <span
            class="drag-handle"
            :class="{ disabled: disabled }"
            :title="disabled ? '' : '拖拽调整构造层顺序（室外到室内）'"
            :aria-label="`拖拽第 ${index + 1} 层调整顺序`"
            :aria-grabbed="dragging"
            :draggable="!disabled"
            @dragstart="onDragStart"
          >
            ⠿
          </span>
          <button
            class="icon-button"
            :disabled="disabled || index === 0"
            :aria-label="`上移第 ${index + 1} 层`"
            @click="emit('move', -1)"
          >
            ↑
          </button>
          <button
            class="icon-button"
            :disabled="disabled || index === total - 1"
            :aria-label="`下移第 ${index + 1} 层`"
            @click="emit('move', 1)"
          >
            ↓
          </button>
          <button
            class="icon-button remove"
            :aria-label="`移除第 ${index + 1} 层`"
            @click="emit('remove')"
          >
            ×
          </button>
        </div>
      </div>
      <div class="layer-inputs">
        <label
          >厚度（毫米）
          <input
            type="number"
            min="0.1"
            max="2000"
            step="0.1"
            :aria-label="`第 ${index + 1} 层厚度`"
            :value="layer.thickness"
            @input="emit('update', { thickness: numeric($event) })"
          />
        </label>
        <label
          >施工损耗（%）
          <input
            type="number"
            min="0"
            max="50"
            step="0.1"
            :aria-label="`第 ${index + 1} 层损耗`"
            :value="layer.loss"
            @input="emit('update', { loss: numeric($event) })"
          />
        </label>
        <label
          >替换寿命（年）
          <input
            type="number"
            min="1"
            max="150"
            :aria-label="`第 ${index + 1} 层寿命`"
            :value="layer.lifespan"
            @input="emit('update', { lifespan: numeric($event) })"
          />
        </label>
      </div>
      <p
        v-if="material"
        class="layer-reference"
      >
        密度 {{ number(material.density) }} 千克/立方米 <span>·</span> 碳因子
        {{ number(material.factor) }} 千克当量/千克
      </p>
    </div>
  </fieldset>
</template>

<style scoped>
.layer-row {
  display: flex;
  gap: 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
  margin: 0 0 12px;
  background: var(--paper);
}
.layer-ordinal {
  width: 34px;
  flex-shrink: 0;
  border-left: 4px solid;
  padding-left: 9px;
  font-size: 14px;
  color: var(--muted);
  padding-top: 8px;
}
.layer-main {
  flex: 1;
  min-width: 0;
}
.layer-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.material-select {
  flex: 1;
  max-width: 260px;
}
.material-kind {
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.layer-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 26px;
  color: var(--muted);
  cursor: grab;
  font-size: 13px;
  line-height: 1;
  user-select: none;
  touch-action: none;
  border-radius: 3px;
}
.drag-handle:hover {
  color: var(--ink);
}
.drag-handle.disabled {
  cursor: default;
  color: var(--line);
}
.layer-row.dragging {
  opacity: 0.45;
}
.layer-row.drop-before {
  box-shadow: inset 0 3px 0 var(--green);
}
.icon-button {
  border: 0;
  background: transparent;
  padding: 7px 9px;
  color: var(--muted);
}
.remove {
  color: #a34f3a;
}
.layer-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.layer-reference {
  color: var(--muted);
  font-size: 10px;
  margin: 10px 0 0;
}
.layer-reference span {
  margin: 0 8px;
}
@media (max-width: 600px) {
  .layer-row {
    padding: 12px;
    gap: 6px;
  }
  .layer-ordinal {
    width: 25px;
  }
  .material-kind {
    display: none;
  }
  .layer-inputs {
    grid-template-columns: 1fr;
  }
}
</style>
