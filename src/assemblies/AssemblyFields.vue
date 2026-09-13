<script setup lang="ts">
import { computed } from 'vue'
import type { Assembly, Surface } from './types'
import { surfaceLabels } from './types'
import type { ThermalBasis } from '../thermal/types'
import { defaultSurfaceResistance } from '../thermal/types'
import { number } from '../shared/format'
const props = defineProps<{ assembly: Assembly; bases: ThermalBasis[]; disabled: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<Assembly>] }>()
const listed = computed(() =>
  props.bases.filter(
    (basis) => basis.state === 'active' || basis.id === props.assembly.thermalBasisId,
  ),
)
const chosen = computed(
  () => props.bases.find((basis) => basis.id === props.assembly.thermalBasisId) ?? null,
)
function numeric(event: Event): number {
  return (event.target as HTMLInputElement).valueAsNumber
}
function selectBasis(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { thermalBasisId: value || null })
}
</script>

<template>
  <fieldset
    class="assembly-fields"
    :disabled="disabled"
  >
    <legend class="sr-only">构造基本条件</legend>
    <label class="wide"
      >构造名称
      <input
        :value="assembly.name"
        maxlength="50"
        @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
      />
    </label>
    <label
      >建筑部位
      <select
        :value="assembly.surface"
        @change="emit('update', { surface: ($event.target as HTMLSelectElement).value as Surface })"
      >
        <option
          v-for="(label, key) in surfaceLabels"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
    </label>
    <label
      >构造面积（平方米）
      <input
        type="number"
        min="0.1"
        max="1000000"
        step="0.1"
        :value="assembly.area"
        @input="emit('update', { area: numeric($event) })"
      />
    </label>
    <label
      >计算年限（年）
      <input
        type="number"
        min="1"
        max="150"
        :value="assembly.years"
        @input="emit('update', { years: numeric($event) })"
      />
    </label>
    <label
      >碳强度目标（千克当量/平方米）
      <input
        type="number"
        min="1"
        max="100000"
        :value="assembly.carbonLimit"
        @input="emit('update', { carbonLimit: numeric($event) })"
      />
    </label>
    <label
      >传热系数上限（瓦/平方米·开尔文）
      <input
        type="number"
        min="0.01"
        max="10"
        step="0.01"
        :value="assembly.thermalLimit"
        @input="emit('update', { thermalLimit: numeric($event) })"
      />
    </label>
    <div class="wide basis-field">
      <label
        >热工计算口径
        <select
          aria-label="热工计算口径"
          :value="assembly.thermalBasisId ?? ''"
          @change="selectBasis"
        >
          <option value="">
            默认口径 · 内表面 {{ defaultSurfaceResistance.inner }} / 外表面
            {{ defaultSurfaceResistance.outer }}
          </option>
          <option
            v-for="basis in listed"
            :key="basis.id"
            :value="basis.id"
          >
            {{ basis.name }}{{ basis.state === 'retired' ? '（已停用）' : '' }}
          </option>
        </select>
      </label>
      <small
        v-if="chosen"
        class="basis-hint"
      >
        内表面 {{ number(chosen.inner) }} · 外表面 {{ number(chosen.outer) }} 平方米·开尔文/瓦 ——
        {{ chosen.note
        }}{{ chosen.state === 'retired' ? '（该口径已停用，可继续沿用或改选）' : '' }}
      </small>
      <small
        v-else
        class="basis-hint"
      >
        未选择口径时采用默认算法：内表面 {{ defaultSurfaceResistance.inner }}、外表面
        {{ defaultSurfaceResistance.outer }} 平方米·开尔文/瓦。可在「热工口径」页新建试算口径。
      </small>
    </div>
    <label class="wide"
      >设计说明
      <textarea
        rows="2"
        maxlength="1000"
        :value="assembly.note"
        placeholder="记录构造假设、参数依据或设计意图"
        @input="emit('update', { note: ($event.target as HTMLTextAreaElement).value })"
      ></textarea>
    </label>
  </fieldset>
</template>

<style scoped>
.assembly-fields {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
.basis-field {
  display: grid;
  gap: 7px;
}
.basis-hint {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.6;
}
@media (max-width: 740px) {
  .assembly-fields {
    grid-template-columns: 1fr;
  }
}
</style>
