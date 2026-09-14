<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ComplianceRule, RuleCondition, RuleMetric } from './types'
import { metricOrder, ruleMetrics } from './types'
import { blankDraft, createCondition } from './factory'
import { validateComplianceRule } from './validation'

const props = defineProps<{
  busy: boolean
  editing: ComplianceRule | null
  submitRule: (draft: {
    id?: string
    name: string
    description: string
    conditions: RuleCondition[]
  }) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()

const form = reactive<{
  id: string
  name: string
  description: string
  conditions: RuleCondition[]
}>(
  props.editing
    ? {
        id: props.editing.id,
        name: props.editing.name,
        description: props.editing.description,
        conditions: props.editing.conditions.map((condition) => ({ ...condition })),
      }
    : { id: '', ...blankDraft() },
)

const availableMetrics = computed(() =>
  metricOrder.filter((metric) => !form.conditions.some((condition) => condition.metric === metric)),
)
const issues = computed(() =>
  validateComplianceRule({
    id: form.id || 'draft',
    name: form.name,
    description: form.description,
    conditions: form.conditions,
    active: true,
    builtIn: false,
    createdAt: '',
    updatedAt: '',
  }),
)

function updateMetric(index: number, metric: RuleMetric) {
  form.conditions[index] = createCondition(metric)
}
function updateValue(index: number, event: Event) {
  form.conditions[index].value = (event.target as HTMLInputElement).valueAsNumber
}
function addCondition() {
  const metric = availableMetrics.value[0]
  if (metric) form.conditions.push(createCondition(metric))
}
function removeCondition(index: number) {
  if (form.conditions.length > 1) form.conditions.splice(index, 1)
}
async function submit() {
  if (issues.value.length || props.busy) return
  if (
    await props.submitRule({ ...form, conditions: form.conditions.map((item) => ({ ...item })) })
  ) {
    emit('cancel')
  }
}
</script>

<template>
  <form
    class="rule-form panel"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>{{ editing ? `修改规则：${editing.name}` : '新建达标规则' }}</h2>
      <button
        type="button"
        class="button small"
        :disabled="busy"
        @click="emit('cancel')"
      >
        收起
      </button>
    </div>
    <p class="section-intro">
      规则由一个或多个上限条件组成，条件之间为“与”关系，全部满足才算达标。规则修改不会追溯改变已生成的历史计算书。
    </p>
    <fieldset
      class="rule-fields"
      :disabled="busy"
    >
      <legend class="sr-only">达标规则内容</legend>
      <label
        >规则名称<input
          v-model="form.name"
          required
          maxlength="40"
          placeholder="例如：外墙低碳口径 2026"
      /></label>
      <label class="wide"
        >规则说明<input
          v-model="form.description"
          maxlength="300"
          placeholder="记录适用部位、口径版本或阈值依据"
      /></label>
    </fieldset>
    <div class="condition-editor">
      <div class="condition-head">
        <h3>组合条件（全部满足）</h3>
        <button
          type="button"
          class="button small"
          :disabled="busy || !availableMetrics.length"
          @click="addCondition"
        >
          ＋ 添加条件
        </button>
      </div>
      <div
        v-for="(condition, index) in form.conditions"
        :key="condition.metric"
        class="condition-row"
      >
        <label
          >计算字段
          <select
            :value="condition.metric"
            @change="updateMetric(index, ($event.target as HTMLSelectElement).value as RuleMetric)"
          >
            <option
              v-for="metric in metricOrder"
              :key="metric"
              :value="metric"
              :disabled="
                metric !== condition.metric &&
                form.conditions.some((other) => other.metric === metric)
              "
            >
              {{ ruleMetrics[metric].label }}（{{ ruleMetrics[metric].unit }}）
            </option>
          </select>
        </label>
        <label
          >上限值<input
            type="number"
            required
            :min="ruleMetrics[condition.metric].min"
            :max="ruleMetrics[condition.metric].max"
            step="any"
            :value="condition.value"
            @input="updateValue(index, $event)"
        /></label>
        <button
          type="button"
          class="button small condition-remove"
          :disabled="busy || form.conditions.length <= 1"
          @click="removeCondition(index)"
        >
          移除
        </button>
      </div>
    </div>
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
    <div class="rule-form-actions">
      <button
        class="button primary"
        type="submit"
        :disabled="busy || issues.length > 0"
      >
        {{ editing ? '保存修改' : '保存规则' }}
      </button>
      <span class="muted">停用规则不会删除它，引用它的历史计算书仍可显示原始判定依据。</span>
    </div>
  </form>
</template>

<style scoped>
.rule-form {
  margin: 24px 0;
}
.rule-fields {
  border: 0;
  padding: 0;
  margin: 18px 0 0;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
.condition-editor {
  margin-top: 22px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.condition-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.condition-row {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 10px;
}
.condition-remove {
  margin-bottom: 2px;
}
.form-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
}
.rule-form-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
}
.rule-form-actions .muted {
  font-size: 11px;
}
@media (max-width: 740px) {
  .rule-fields,
  .condition-row {
    grid-template-columns: 1fr;
  }
}
</style>
