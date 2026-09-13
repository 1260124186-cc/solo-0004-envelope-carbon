<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { ThermalBasis } from './types'
import { defaultSurfaceResistance } from './types'
import BasisForm from './BasisForm.vue'
import BasisCard from './BasisCard.vue'
const props = defineProps<{
  bases: ThermalBasis[]
  assemblies: Assembly[]
  busy: boolean
  submitBasis: (basis: ThermalBasis) => Promise<boolean>
  retireBasis: (id: string) => Promise<boolean>
}>()
const showForm = shallowRef(false)
const usage = computed(() => {
  const counts = new Map<string, number>()
  for (const assembly of props.assemblies) {
    if (assembly.thermalBasisId) {
      counts.set(assembly.thermalBasisId, (counts.get(assembly.thermalBasisId) ?? 0) + 1)
    }
  }
  return counts
})
</script>

<template>
  <section class="basis-workspace panel">
    <div class="section-heading">
      <div>
        <span class="eyebrow">试算场景</span>
        <h1>热工计算口径，先约定再计算。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy"
        @click="showForm = !showForm"
      >
        {{ showForm ? '收起表单' : '＋ 新建口径' }}
      </button>
    </div>
    <p class="section-intro">
      口径记录一组内外表面热阻设置及其依据，供不同试算场景选用。构造未选择口径时，仍采用默认算法（内表面
      {{ defaultSurfaceResistance.inner }}、外表面
      {{ defaultSurfaceResistance.outer }}
      平方米·开尔文/瓦）。口径停用后不可再选用，已选用的构造与已定稿计算书保持原结果。
    </p>
    <BasisForm
      v-if="showForm"
      :busy="busy"
      :submit-basis="submitBasis"
      @cancel="showForm = false"
    />
    <div
      v-if="bases.length"
      class="basis-grid"
    >
      <BasisCard
        v-for="basis in bases"
        :key="basis.id"
        :basis="basis"
        :usage="usage.get(basis.id) ?? 0"
        :busy="busy"
        @retire="retireBasis"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      还没有热工计算口径。新建口径后，可在构造编辑中为构造选用。
    </div>
  </section>
</template>

<style scoped>
.basis-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.basis-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
@media (max-width: 1000px) {
  .basis-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .basis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
