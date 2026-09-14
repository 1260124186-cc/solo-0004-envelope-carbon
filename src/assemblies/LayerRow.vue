<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from './types'
import type { Material } from '../materials/types'
import { kindColors, kindLabels } from '../materials/types'
import { number } from '../shared/format'
import MaterialPicker from '../materials/MaterialPicker.vue'
const props = defineProps<{
  layer: Layer
  index: number
  total: number
  materials: Material[]
  disabled: boolean
}>()
const emit = defineEmits<{
  update: [patch: Partial<Layer>]
  remove: []
  move: [direction: -1 | 1]
}>()
const material = computed(() => props.materials.find((item) => item.id === props.layer.materialId))
function replaceMaterial(payload: { material: Material; adoptLifespan: boolean }) {
  // 替换语义：仅更换材料物性；厚度与施工损耗保留本层原值。
  // 寿命是否采用新材料参考寿命，由用户在选择器中显式决定。
  const patch: Partial<Layer> = { materialId: payload.material.id }
  if (payload.adoptLifespan) patch.lifespan = payload.material.lifespan
  emit('update', patch)
}
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
</script>

<template>
  <fieldset
    class="layer-row"
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
        <div class="material-name-cell">
          <span
            class="material-name"
            :title="material ? material.name : '材料缺失'"
            >{{ material ? material.name : '材料已不在目录中' }}</span
          >
          <span
            v-if="material"
            class="material-kind"
            >{{ kindLabels[material.kind] }}</span
          >
          <MaterialPicker
            :materials="materials"
            :disabled="disabled"
            mode="replace"
            :current-material-id="layer.materialId"
            :current-lifespan="layer.lifespan"
            @replace="replaceMaterial"
          >
            <template #trigger="{ open }">
              <button
                type="button"
                class="button small replace-button"
                :disabled="disabled"
                aria-haspopup="dialog"
                :aria-label="`更换第 ${index + 1} 层材料`"
                @click="open()"
              >
                更换材料
              </button>
            </template>
          </MaterialPicker>
        </div>
        <div class="layer-actions">
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
        密度 {{ number(material.density) }} 千克/立方米 <span>·</span> 导热系数
        {{ number(material.conductivity) }} 瓦/米·开尔文 <span>·</span> 碳因子
        {{ number(material.factor) }} 千克当量/千克
        <span>·</span>
        {{ material.custom ? '自定义物性' : '教学示例' }}
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
.material-name-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.material-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.replace-button {
  flex-shrink: 0;
}
.material-kind {
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.layer-actions {
  display: flex;
  margin-left: auto;
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
  .material-name {
    max-width: 130px;
  }
  .layer-inputs {
    grid-template-columns: 1fr;
  }
}
</style>
