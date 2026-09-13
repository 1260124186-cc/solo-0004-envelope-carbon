<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { ReplacementPlan } from './types'
import { date } from '../shared/format'
import PlanSheet from './PlanSheet.vue'

const props = defineProps<{
  assembly: Assembly
  plans: ReplacementPlan[]
  dirty: boolean
  busy: boolean
  valid: boolean
}>()
const emit = defineEmits<{ save: []; design: [] }>()

const selectedId = shallowRef('')
watch(
  () => props.plans,
  (plans) => {
    if (!plans.some((plan) => plan.id === selectedId.value)) selectedId.value = plans[0]?.id ?? ''
  },
  { immediate: true },
)
const selected = computed(() => props.plans.find((plan) => plan.id === selectedId.value))
</script>

<template>
  <section class="plan-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">替换时序</span>
        <h1>每一次替换，落在哪一年。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy || dirty || !valid"
        @click="emit('save')"
      >
        生成并保存计划
      </button>
    </div>
    <p class="section-intro">
      计划从当前已保存构造生成，按年份列出各材料层的替换记录与当年合计；保存时冻结构造与材料物性，后续编辑原构造不影响已保存计划。
    </p>
    <p
      v-if="dirty"
      class="inline-warning"
    >
      当前构造有未保存的修改，请先返回构造编辑保存，再生成计划。
    </p>
    <div
      v-if="!plans.length"
      class="empty-state"
    >
      <h2>这个构造还没有材料替换计划</h2>
      <p>完成构造编辑并保存后，点击「生成并保存计划」。</p>
      <button
        class="button"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <label class="plan-version"
        >已保存计划
        <select
          aria-label="已保存计划"
          v-model="selectedId"
        >
          <option
            v-for="plan in plans"
            :key="plan.id"
            :value="plan.id"
          >
            修订 {{ plan.assembly.revision }} · {{ date(plan.createdAt) }}
          </option>
        </select>
      </label>
      <PlanSheet
        v-if="selected"
        :plan="selected"
      />
    </template>
  </section>
</template>

<style scoped>
.plan-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.plan-version {
  max-width: 420px;
  margin: 24px 0;
}
</style>
