<script setup lang="ts">
defineProps<{
  error: string
  notice: string
  externalChange: boolean
  busy: boolean
}>()
const emit = defineEmits<{ reload: [] }>()
</script>

<template>
  <div
    v-if="externalChange"
    class="feedback warning"
    aria-live="polite"
  >
    <span>另一标签页的保存版本已变化。为避免覆盖，请先重新加载。</span>
    <button
      class="button small"
      :disabled="busy"
      @click="emit('reload')"
    >
      重新加载保存版本
    </button>
  </div>
  <div
    v-if="error"
    class="feedback failure"
    role="alert"
  >
    {{ error }}
  </div>
  <div
    v-if="notice"
    class="feedback success"
    role="status"
  >
    {{ notice }}
  </div>
</template>

<style scoped>
.feedback {
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid;
  border-radius: 6px;
  white-space: pre-line;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.warning {
  background: #fff8e7;
  border-color: #e5d7af;
  color: #73581e;
}
.failure {
  background: #fff0eb;
  border-color: #eacac0;
  color: #922f20;
}
.success {
  background: var(--green-pale);
  border-color: #c4dbce;
  color: var(--green);
}
</style>
