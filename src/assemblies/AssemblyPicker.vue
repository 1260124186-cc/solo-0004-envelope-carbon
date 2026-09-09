<script setup lang="ts">
import type { Assembly } from './types'
import { stateLabels } from './types'
defineProps<{
  assemblies: Assembly[]
  selectedId: string
  busy: boolean
  canDuplicate: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  create: []
  duplicate: []
}>()
</script>

<template>
  <div class="assembly-picker">
    <label class="picker-label">
      当前构造
      <select
        aria-label="当前构造"
        :value="selectedId"
        :disabled="busy"
        @change="emit('select', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-if="!assemblies.some((item) => item.id === selectedId)"
          :value="selectedId"
        >
          未保存的新构造
        </option>
        <option
          v-for="item in assemblies"
          :key="item.id"
          :value="item.id"
        >
          {{ item.name }} · {{ stateLabels[item.state] }}
        </option>
      </select>
    </label>
    <div class="picker-actions">
      <button
        class="button"
        :disabled="busy"
        @click="emit('create')"
      >
        ＋ 新建构造
      </button>
      <button
        class="button"
        :disabled="busy || !canDuplicate"
        @click="emit('duplicate')"
      >
        复制为替代方案
      </button>
    </div>
  </div>
</template>

<style scoped>
.assembly-picker {
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
.picker-actions {
  display: flex;
  gap: 8px;
}
@media (max-width: 700px) {
  .assembly-picker {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .picker-label {
    min-width: 0;
  }
  .picker-actions {
    flex-wrap: wrap;
  }
}
</style>
