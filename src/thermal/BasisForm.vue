<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ThermalBasis } from './types'
import { defaultSurfaceResistance } from './types'
import { validateBasis } from './validation'
const props = defineProps<{
  busy: boolean
  submitBasis: (basis: ThermalBasis) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()
const form = reactive<ThermalBasis>({
  id: '',
  name: '',
  inner: defaultSurfaceResistance.inner,
  outer: defaultSurfaceResistance.outer,
  note: '',
  state: 'active',
})
const issues = computed(() => validateBasis(form))
async function submit() {
  if (issues.value.length || props.busy) return
  if (await props.submitBasis({ ...form })) emit('cancel')
}
</script>

<template>
  <form
    class="basis-form"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>新建热工计算口径</h2>
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
      class="basis-form-fields"
      :disabled="busy"
    >
      <legend class="sr-only">热工计算口径设置</legend>
      <label
        >口径名称<input
          v-model="form.name"
          required
          maxlength="50"
          placeholder="用名称区分不同试算场景"
      /></label>
      <label
        >内表面热阻（平方米·开尔文/瓦）<input
          v-model.number="form.inner"
          required
          type="number"
          min="0.01"
          max="1"
          step="any"
      /></label>
      <label
        >外表面热阻（平方米·开尔文/瓦）<input
          v-model.number="form.outer"
          required
          type="number"
          min="0.01"
          max="1"
          step="any"
      /></label>
      <label class="wide"
        >依据说明<input
          v-model="form.note"
          required
          maxlength="200"
          placeholder="填写取值依据，如标准条文、场景假设"
      /></label>
    </fieldset>
    <p class="muted form-help">
      口径保存后保持原值；不同设置请建立新口径，以保证既有构造与计算书可追溯。
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
      保存口径
    </button>
  </form>
</template>

<style scoped>
.basis-form {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.basis-form-fields {
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
  .basis-form-fields {
    grid-template-columns: 1fr;
  }
}
</style>
