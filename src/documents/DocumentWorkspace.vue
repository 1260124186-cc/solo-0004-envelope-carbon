<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { CarbonDocument } from './types'
import { date } from '../shared/format'
import DocumentSheet from './DocumentSheet.vue'
const props = defineProps<{
  assembly: Assembly
  documents: CarbonDocument[]
  dirty: boolean
  busy: boolean
  valid: boolean
  archived?: boolean
}>()
const emit = defineEmits<{
  finalize: []
  reopen: []
  design: []
  restore: []
}>()
const selectedId = shallowRef('')
watch(
  () => props.documents,
  (documents) => {
    if (!documents.some((document) => document.id === selectedId.value))
      selectedId.value = documents[0]?.id ?? ''
  },
  { immediate: true },
)
const selected = computed(() =>
  props.documents.find((document) => document.id === selectedId.value),
)
</script>

<template>
  <section class="document-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">设计留痕</span>
        <h1>把这一版，留在计算书里。</h1>
      </div>
      <button
        v-if="assembly.state === 'finalized'"
        class="button"
        :disabled="busy"
        @click="emit('reopen')"
      >
        重新开启编辑
      </button>
      <button
        v-else
        class="button primary"
        :disabled="busy || dirty || !valid"
        @click="emit('finalize')"
      >
        生成定稿
      </button>
    </div>
    <p class="section-intro">定稿将冻结构造与全部材料物性，计算书始终按生成时的输入显示。</p>
    <p
      v-if="archived"
      class="inline-warning"
    >
      该构造已归档：它已从「当前构造」和「方案比较」中隐藏，但历史计算书仍可在此打开，定稿只读状态也未改变。恢复后按原身份回到工作列表。
      <button
        class="button small inline-action"
        :disabled="busy"
        @click="emit('restore')"
      >
        恢复到当前列表
      </button>
    </p>
    <p
      v-if="dirty"
      class="inline-warning"
    >
      请先返回构造编辑保存修改，才能生成本次定稿。
    </p>
    <div
      v-if="!documents.length"
      class="empty-state"
    >
      <h2>这个构造还没有计算书</h2>
      <p>完成构造编辑并保存后，点击「生成定稿」。</p>
      <button
        class="button"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <label class="document-version"
        >历史计算书
        <select v-model="selectedId">
          <option
            v-for="document in documents"
            :key="document.id"
            :value="document.id"
          >
            修订 {{ document.assembly.revision }} · {{ date(document.createdAt) }}
          </option>
        </select>
      </label>
      <DocumentSheet
        v-if="selected"
        :document="selected"
      />
    </template>
  </section>
</template>

<style scoped>
.document-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.document-version {
  max-width: 420px;
  margin: 24px 0;
}
.inline-action {
  margin-left: 12px;
  vertical-align: baseline;
}
</style>
