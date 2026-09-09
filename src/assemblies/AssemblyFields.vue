<script setup lang="ts">
import type { Assembly, Surface } from './types'
import { surfaceLabels } from './types'
defineProps<{ assembly: Assembly; disabled: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<Assembly>] }>()
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
</script>

<template>
  <fieldset
    class="assembly-fields"
    :disabled="disabled"
  >
    <legend class="sr-only">构造基本条件</legend>
    <label class="wide"
      >构造名称
      <input
        :value="assembly.name"
        maxlength="50"
        @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
      />
    </label>
    <label
      >建筑部位
      <select
        :value="assembly.surface"
        @change="emit('update', { surface: ($event.target as HTMLSelectElement).value as Surface })"
      >
        <option
          v-for="(label, key) in surfaceLabels"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
    </label>
    <label
      >构造面积（平方米）
      <input
        type="number"
        min="0.1"
        max="1000000"
        step="0.1"
        :value="assembly.area"
        @input="emit('update', { area: numeric($event) })"
      />
    </label>
    <label
      >计算年限（年）
      <input
        type="number"
        min="1"
        max="150"
        :value="assembly.years"
        @input="emit('update', { years: numeric($event) })"
      />
    </label>
    <label
      >碳强度目标（千克当量/平方米）
      <input
        type="number"
        min="1"
        max="100000"
        :value="assembly.carbonLimit"
        @input="emit('update', { carbonLimit: numeric($event) })"
      />
    </label>
    <label
      >传热系数上限（瓦/平方米·开尔文）
      <input
        type="number"
        min="0.01"
        max="10"
        step="0.01"
        :value="assembly.thermalLimit"
        @input="emit('update', { thermalLimit: numeric($event) })"
      />
    </label>
    <label class="wide"
      >设计说明
      <textarea
        rows="2"
        maxlength="1000"
        :value="assembly.note"
        placeholder="记录构造假设、参数依据或设计意图"
        @input="emit('update', { note: ($event.target as HTMLTextAreaElement).value })"
      ></textarea>
    </label>
  </fieldset>
</template>

<style scoped>
.assembly-fields {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
@media (max-width: 740px) {
  .assembly-fields {
    grid-template-columns: 1fr;
  }
}
</style>
