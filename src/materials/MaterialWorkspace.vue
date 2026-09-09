<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Material, MaterialKind } from './types'
import { kindLabels } from './types'
import MaterialCard from './MaterialCard.vue'
import MaterialForm from './MaterialForm.vue'
const props = defineProps<{
  materials: Material[]
  busy: boolean
  submitMaterial: (material: Material) => Promise<boolean>
}>()
const query = shallowRef('')
const kind = shallowRef<MaterialKind | ''>('')
const showForm = shallowRef(false)
const visible = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return props.materials.filter(
    (material) =>
      (!kind.value || material.kind === kind.value) &&
      (!needle || `${material.name} ${material.source}`.toLocaleLowerCase().includes(needle)),
  )
})
</script>

<template>
  <section class="material-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">参数依据</span>
        <h1>材料，先看物性。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy"
        @click="showForm = !showForm"
      >
        {{ showForm ? '收起表单' : '＋ 自定义材料' }}
      </button>
    </div>
    <p class="section-intro">
      内置参数仅供教学演示。实际工程请建立带来源的材料参数，再用于构造计算。
    </p>
    <MaterialForm
      v-if="showForm"
      :busy="busy"
      :submit-material="submitMaterial"
      @cancel="showForm = false"
    />
    <div class="material-filters">
      <label class="search-label"
        >搜索材料<input
          v-model="query"
          type="search"
          placeholder="材料名称或参数来源"
      /></label>
      <label
        >材料类别
        <select v-model="kind">
          <option value="">全部类别</option>
          <option
            v-for="(label, key) in kindLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <span class="muted">{{ visible.length }} 种材料</span>
    </div>
    <div
      v-if="visible.length"
      class="material-grid"
    >
      <MaterialCard
        v-for="material in visible"
        :key="material.id"
        :material="material"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      没有符合条件的材料。请调整搜索词或类别。
    </div>
  </section>
</template>

<style scoped>
.material-filters {
  display: flex;
  gap: 16px;
  align-items: end;
  margin: 24px 0;
}
.search-label {
  flex: 1;
  max-width: 440px;
}
.material-filters > span {
  padding-bottom: 12px;
  margin-left: auto;
  font-size: 11px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
@media (max-width: 1000px) {
  .material-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .material-grid {
    grid-template-columns: 1fr;
  }
  .material-filters {
    flex-direction: column;
    align-items: stretch;
  }
  .material-filters > span {
    margin-left: 0;
  }
}
</style>
