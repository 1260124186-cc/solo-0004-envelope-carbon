<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Material, MaterialKind } from './types'
import { kindLabels } from './types'
import { validateMaterial } from './validation'
const props = defineProps<{
  busy: boolean
  submitMaterial: (material: Material) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()
const form = reactive<Material>({
  id: '',
  name: '',
  kind: 'insulation',
  density: 120,
  conductivity: 0.04,
  factor: 1,
  lifespan: 30,
  source: '',
  description: '',
  custom: true,
  retired: false,
})
const issues = computed(() => validateMaterial(form))
async function submit() {
  if (issues.value.length || props.busy) return
  if (await props.submitMaterial({ ...form })) emit('cancel')
}
</script>

<template>
  <form
    class="material-form"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>添加自定义物性</h2>
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
      class="material-form-fields"
      :disabled="busy"
    >
      <legend class="sr-only">自定义材料参数</legend>
      <label
        >材料名称<input
          v-model="form.name"
          required
          maxlength="40"
          placeholder="用名称区分不同来源或规格"
      /></label>
      <label
        >材料类别
        <select v-model="form.kind">
          <option
            v-for="(label, key) in kindLabels"
            :key="key"
            :value="key as MaterialKind"
          >
            {{ label }}
          </option>
        </select>
      </label>
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
          placeholder="填写资料名称、年份和适用范围"
      /></label>
      <label class="wide"
        >材料说明<textarea
          v-model="form.description"
          rows="2"
          maxlength="500"
        />
      </label>
    </fieldset>
    <p class="muted form-help">
      材料创建后保持原值；不同物性请建立新材料，以保证既有构造计算可追溯。
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
      保存材料参数
    </button>
  </form>
</template>

<style scoped>
.material-form {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.material-form-fields {
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
  .material-form-fields {
    grid-template-columns: 1fr;
  }
}
</style>
