<script setup lang="ts">
import { computed } from 'vue'
import type { ConstructionTemplate } from './types'
import { surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import { kindLabels } from '../materials/types'
import { date, number } from '../shared/format'
import { missingTemplateMaterials } from './validation'
const props = defineProps<{
  template: ConstructionTemplate
  materials: Material[]
  busy: boolean
}>()
const emit = defineEmits<{
  preview: []
  edit: []
  remove: []
}>()
const resolved = computed(() =>
  props.template.layers.map((layer) =>
    props.materials.find((item) => item.id === layer.materialId),
  ),
)
const totalThickness = computed(() =>
  props.template.layers.reduce((sum, layer) => sum + layer.thickness, 0),
)
const missing = computed(() => missingTemplateMaterials(props.template.layers, props.materials))
</script>

<template>
  <article class="template-card">
    <div class="card-head">
      <h3>{{ template.name }}</h3>
      <span class="surface-tag">{{ surfaceLabels[template.surface] }}</span>
    </div>
    <p class="usage">{{ template.usage }}</p>
    <ul class="layer-summary">
      <li
        v-for="(material, index) in resolved"
        :key="index"
        :class="{ unavailable: !material }"
      >
        <span class="layer-no">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="layer-name">{{ material ? material.name : '材料不可用' }}</span>
        <span
          v-if="material"
          class="layer-kind"
          >{{ kindLabels[material.kind] }}</span
        >
        <span class="layer-thickness">{{ number(template.layers[index].thickness) }} mm</span>
      </li>
    </ul>
    <div class="card-meta">
      <span>{{ template.layers.length }} 层 · 总厚 {{ number(totalThickness) }} mm</span>
      <span>更新于 {{ date(template.updatedAt) }}</span>
    </div>
    <p
      v-if="missing.length"
      class="missing-note"
      role="alert"
    >
      {{ missing.map((item) => `第 ${item.index} 层`).join('、') }}材料引用不可用，暂不能套用。
    </p>
    <div class="card-actions">
      <button
        class="button small primary"
        :disabled="busy"
        @click="emit('preview')"
      >
        预览并套用
      </button>
      <button
        class="button small"
        :disabled="busy"
        @click="emit('edit')"
      >
        修改
      </button>
      <button
        class="button small remove"
        :disabled="busy"
        @click="emit('remove')"
      >
        删除
      </button>
    </div>
  </article>
</template>

<style scoped>
.template-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.card-head h3 {
  margin: 0;
  font-size: 15px;
}
.surface-tag {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--green);
  background: var(--green-pale);
  padding: 4px 8px;
  border-radius: 4px;
}
.usage {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.layer-summary {
  list-style: none;
  margin: 0;
  padding: 10px 12px;
  background: #f6f7f0;
  border-radius: 6px;
  font-size: 11px;
  display: grid;
  gap: 6px;
}
.layer-summary li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.layer-summary li.unavailable {
  color: #922f20;
}
.layer-no {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.layer-name {
  flex: 1;
}
.layer-kind {
  color: var(--muted);
  font-size: 10px;
}
.layer-thickness {
  font-variant-numeric: tabular-nums;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--muted);
}
.missing-note {
  margin: 0;
  font-size: 11px;
  color: #922f20;
  background: #fff0eb;
  border: 1px solid #eacac0;
  border-radius: 4px;
  padding: 8px 10px;
  line-height: 1.7;
}
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
.remove {
  margin-left: auto;
  color: #922f20;
}
</style>
