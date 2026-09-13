<script setup lang="ts">
import type { EnvelopeScheme } from './types'
defineProps<{
  schemes: EnvelopeScheme[]
  selectedId: string
  busy: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  create: []
}>()
</script>

<template>
  <div class="scheme-picker">
    <label class="picker-label">
      当前组合
      <select
        aria-label="当前围护组合"
        :value="selectedId"
        :disabled="busy"
        @change="emit('select', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-if="!schemes.some((item) => item.id === selectedId)"
          :value="selectedId"
        >
          未保存的新组合
        </option>
        <option
          v-for="item in schemes"
          :key="item.id"
          :value="item.id"
        >
          {{ item.name }} · {{ item.entries.length }} 个部位
        </option>
      </select>
    </label>
    <div class="picker-actions">
      <button
        class="button"
        :disabled="busy"
        @click="emit('create')"
      >
        ＋ 新建组合
      </button>
    </div>
  </div>
</template>

<style scoped>
.scheme-picker {
  display: flex;
  gap: 20px;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 24px;
}
.picker-label {
  display: grid;
  gap: 7px;
  color: var(--muted);
  font-size: 11px;
  min-width: 330px;
}
.picker-label select {
  font-size: 14px;
  font-weight: 600;
  background: var(--paper);
}
@media (max-width: 700px) {
  .scheme-picker {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .picker-label {
    min-width: 0;
  }
}
</style>
