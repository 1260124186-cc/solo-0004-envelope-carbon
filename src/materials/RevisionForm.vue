<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Material, RevisionInput } from './types'
import { latestRevision } from './revisions'
import { validateRevisionInput } from './validation'
const props = defineProps<{
  material: Material
  busy: boolean
  submitRevision: (materialId: string, input: RevisionInput) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()
const latest = latestRevision(props.material)
const form = reactive<RevisionInput>({
  density: latest.density,
  conductivity: latest.conductivity,
  factor: latest.factor,
  lifespan: latest.lifespan,
  source: latest.source,
  note: '',
})
const issues = computed(() => validateRevisionInput(form))
async function submit() {
  if (issues.value.length || props.busy) return
  if (await props.submitRevision(props.material.id, { ...form })) emit('cancel')
}
</script>

<template>
  <form
    class="revision-form"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>修订「{{ material.name }}」的物性</h2>
      <button
        type="button"
        class="button small"
        :disabled="busy"
        @click="emit('cancel')"
      >
        收起
      </button>
    </div>
    <fieldset
      class="revision-form-fields"
      :disabled="busy"
    >
      <legend class="sr-only">修订材料物性</legend>
      <label
        >密度（千克/立方米）<input
          v-model.number="form.density"
          required
          type="number"
          min="1"
          max="30000"
          step="any"
      /></label>
      <label
        >导热系数（瓦/米·开尔文）<input
          v-model.number="form.conductivity"
          required
          type="number"
          min="0.001"
          max="500"
          step="any"
      /></label>
      <label
        >碳因子（千克当量/千克）<input
          v-model.number="form.factor"
          required
          type="number"
          min="0"
          max="100"
          step="any"
      /></label>
      <label
        >参考寿命（年）<input
          v-model.number="form.lifespan"
          required
          type="number"
          min="1"
          max="150"
      /></label>
      <label class="wide"
        >参数来源<input
          v-model="form.source"
          required
          maxlength="200"
          placeholder="填写本次参数的资料名称、年份和适用范围"
      /></label>
      <label class="wide"
        >修订说明<input
          v-model="form.note"
          maxlength="200"
          placeholder="说明本次修订原因，例如更换参数来源"
      /></label>
    </fieldset>
    <p class="muted form-help">
      保存后生成版本 {{ latest.revision + 1 }}，版本 {{ latest.revision }}
      保持不变；既有构造继续引用原版本，可在构造编辑中逐层升级。
    </p>
    <ul
      v-if="issues.length"
      class="form-issues"
    >
      <li
        v-for="issue in issues"
        :key="issue"
      >
        {{ issue }}
      </li>
    </ul>
    <button
      class="button primary"
      type="submit"
      :disabled="busy || issues.length > 0"
    >
      保存新版本
    </button>
  </form>
</template>

<style scoped>
.revision-form {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.revision-form-fields {
  border: 0;
  padding: 0;
  margin: 20px 0 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
.form-help {
  font-size: 11px;
  margin-top: 16px;
}
.form-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
}
@media (max-width: 600px) {
  .revision-form-fields {
    grid-template-columns: 1fr;
  }
}
</style>
