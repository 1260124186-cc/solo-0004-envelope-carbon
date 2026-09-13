<script setup lang="ts">
import { computed } from 'vue'
import type { EntryEvaluation } from './types'
const props = defineProps<{ entries: EntryEvaluation[]; busy: boolean }>()
const emit = defineEmits<{
  keep: [entryId: string]
  update: [entryId: string]
}>()
// 已显式「保留冻结版本」的部位不再重复提示；原构造再次变化会重新出现。
const pending = computed(() =>
  props.entries.filter(
    (entry) => !entry.acknowledged && (entry.status === 'modified' || entry.status === 'missing'),
  ),
)
</script>

<template>
  <div
    v-for="item in pending"
    :key="item.entry.id"
    class="drift-banner"
    role="alert"
  >
    <div class="drift-text">
      <strong v-if="item.status === 'missing'"
        >部位「{{ item.entry.name }}」引用的构造已被删除。</strong
      >
      <strong v-else>部位「{{ item.entry.name }}」引用的构造后来被修改了。</strong>
      <p v-if="item.status === 'missing'">
        组合仍按保存时冻结的版本计算（修订
        {{
          item.entry.revision
        }}），结果不会被悄悄改变。该构造已无法再次更新引用，可移除此部位，或保留冻结版本。
      </p>
      <p v-else>
        为避免已保存组合结果被悄悄改变，当前仍使用引用时冻结的修订
        {{ item.entry.revision }}。请选择处理方式。
      </p>
    </div>
    <div class="drift-actions">
      <button
        class="button small"
        :disabled="busy"
        @click="emit('keep', item.entry.id)"
      >
        保留冻结版本
      </button>
      <button
        v-if="item.status === 'modified'"
        class="button small primary"
        :disabled="busy"
        @click="emit('update', item.entry.id)"
      >
        更新为当前版本
      </button>
    </div>
  </div>
</template>

<style scoped>
.drift-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff8e7;
  border: 1px solid #e5d7af;
  color: #73581e;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 10px;
}
.drift-text p {
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.7;
}
.drift-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 740px) {
  .drift-banner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
