<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Material } from './types'
const props = defineProps<{ materials: Material[]; disabled: boolean }>()
const emit = defineEmits<{ add: [material: Material] }>()
const selectedId = shallowRef('')
watch(
  () => props.materials,
  (items) => {
    if (!items.some((item) => item.id === selectedId.value)) selectedId.value = items[0]?.id ?? ''
  },
  { immediate: true },
)
const selected = computed(() => props.materials.find((item) => item.id === selectedId.value))
function add() {
  if (selected.value && !props.disabled) emit('add', selected.value)
}
</script>

<template>
  <div class="material-picker">
    <label
      >添加构造层
      <select
        aria-label="添加构造层"
        v-model="selectedId"
        :disabled="disabled"
      >
        <option
          v-for="material in materials"
          :key="material.id"
          :value="material.id"
        >
          {{ material.name }}
        </option>
      </select>
    </label>
    <button
      class="button"
      :disabled="disabled || !selected"
      @click="add"
    >
      ＋ 添加这一层
    </button>
  </div>
</template>

<style scoped>
.material-picker {
  display: flex;
  gap: 12px;
  align-items: end;
  padding: 18px;
  border: 1px dashed #b9c8bf;
  border-radius: 6px;
  background: #f3f7f1;
}
.material-picker label {
  flex: 1;
}
@media (max-width: 600px) {
  .material-picker {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
