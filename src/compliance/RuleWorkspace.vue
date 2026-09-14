<script setup lang="ts">
import { shallowRef } from 'vue'
import type { ComplianceRule } from './types'
import { ruleMetrics } from './types'
import { describeCondition } from './factory'
import RuleForm from './RuleForm.vue'

const props = defineProps<{
  rules: ComplianceRule[]
  busy: boolean
  usageCount: (id: string) => number
  submitRule: (draft: {
    id?: string
    name: string
    description: string
    conditions: ComplianceRule['conditions']
  }) => Promise<boolean>
  setActive: (id: string, active: boolean) => Promise<boolean>
}>()

const editingId = shallowRef<string | null>(null)
const creating = shallowRef(false)
const editingRule = shallowRef<ComplianceRule | null>(null)

function startCreate() {
  editingId.value = null
  editingRule.value = null
  creating.value = true
}
function startEdit(rule: ComplianceRule) {
  if (rule.builtIn) return
  creating.value = false
  editingId.value = rule.id
  editingRule.value = rule
}
function closeForm() {
  creating.value = false
  editingId.value = null
  editingRule.value = null
}
async function toggle(rule: ComplianceRule) {
  await props.setActive(rule.id, !rule.active)
}
</script>

<template>
  <section class="rule-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">判定口径</span>
        <h1>同一套规则，同一把尺子。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy"
        @click="startCreate"
      >
        ＋ 新建达标规则
      </button>
    </div>
    <p class="section-intro">
      用生命周期强度、整个构造隐含碳、传热系数、总厚度等计算结果组合定义达标条件，供各构造复用。
      规则可保存、修改与停用；修改与停用都不会追溯改变历史计算书，停用规则的判定依据仍随历史计算书显示。
    </p>
    <RuleForm
      v-if="creating"
      :key="'new'"
      :busy="busy"
      :editing="null"
      :submit-rule="submitRule"
      @cancel="closeForm"
    />
    <RuleForm
      v-else-if="editingId && editingRule"
      :key="editingId"
      :busy="busy"
      :editing="editingRule"
      :submit-rule="submitRule"
      @cancel="closeForm"
    />
    <div
      v-if="!rules.length"
      class="empty-state"
    >
      还没有自定义达标规则。点击「新建达标规则」开始定义团队共享的判定口径。
    </div>
    <div
      v-else
      class="rule-list"
    >
      <article
        v-for="rule in rules"
        :key="rule.id"
        :class="['rule-card', { inactive: !rule.active }]"
      >
        <header>
          <div>
            <h2>{{ rule.name }}</h2>
            <span class="rule-tags">
              <span :class="['rule-state', rule.active ? 'on' : 'off']">{{
                rule.active ? '启用中' : '已停用'
              }}</span>
              <span
                v-if="rule.builtIn"
                class="rule-builtin"
                >内置示例</span
              >
              <span class="rule-usage">{{ usageCount(rule.id) }} 个构造引用</span>
            </span>
          </div>
          <div class="actions">
            <button
              class="button small"
              :disabled="busy || rule.builtIn"
              :title="rule.builtIn ? '内置示例规则不可修改，可另存自定义规则' : '修改规则'"
              @click="startEdit(rule)"
            >
              修改
            </button>
            <button
              class="button small"
              :disabled="busy || rule.builtIn"
              @click="toggle(rule)"
            >
              {{ rule.active ? '停用' : '重新启用' }}
            </button>
          </div>
        </header>
        <p class="rule-description">{{ rule.description || '无补充说明。' }}</p>
        <ul class="rule-conditions">
          <li
            v-for="condition in rule.conditions"
            :key="condition.metric"
          >
            <span class="condition-bullet">且</span>
            {{ describeCondition(condition.metric, condition.value) }}
          </li>
        </ul>
        <footer>
          可用字段：{{ rule.conditions.map((c) => ruleMetrics[c.metric].shortLabel).join('、') }}
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.rule-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.rule-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rule-card.inactive {
  opacity: 0.68;
}
.rule-card header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.rule-card h2 {
  font-size: 16px;
}
.rule-tags {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}
.rule-state,
.rule-builtin,
.rule-usage {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
}
.rule-state.on {
  color: var(--green);
  background: var(--green-pale);
}
.rule-state.off {
  color: #865629;
  background: #fcf3de;
}
.rule-builtin {
  color: var(--muted);
  background: #eef0e8;
}
.rule-usage {
  color: var(--muted);
}
.rule-description {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.8;
  margin: 0;
}
.rule-conditions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.rule-conditions li {
  background: #f4f7f1;
  padding: 8px 10px;
  border-radius: 4px;
}
.condition-bullet {
  color: var(--muted);
  font-size: 10px;
  margin-right: 6px;
}
.rule-card footer {
  margin-top: auto;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  font-size: 10px;
  color: var(--muted);
}
@media (max-width: 900px) {
  .rule-list {
    grid-template-columns: 1fr;
  }
}
</style>
