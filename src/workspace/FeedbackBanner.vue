<script setup lang="ts">
defineProps<{
  error: string
  notice: string
  externalChange: boolean
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{ reload: []; resolve: [] }>()
</script>

<template>
  <div
    v-if="externalChange"
    class="feedback warning"
    aria-live="polite"
  >
    <span
      >另一标签页的保存版本已变化。可重新加载；当前页有未保存修改时，也可保留草稿并处理差异。</span
    >
    <span class="banner-actions">
      <button
        v-if="dirty"
        class="button small"
        :disabled="busy"
        @click="emit('resolve')"
      >
        保留草稿并处理差异
      </button>
      <button
        class="button small"
        :disabled="busy"
        @click="emit('reload')"
      >
        重新加载保存版本
      </button>
    </span>
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
.banner-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
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
