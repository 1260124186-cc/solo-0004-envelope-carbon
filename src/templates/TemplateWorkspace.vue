<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { ConstructionTemplate, TemplateLayer } from './types'
import { surfaceLabels } from '../assemblies/types'
import type { Surface } from '../assemblies/types'
import type { Finding } from '../assemblies/types'
import type { Material } from '../materials/types'
import TemplateCard from './TemplateCard.vue'
import TemplateForm from './TemplateForm.vue'
import TemplatePreview from './TemplatePreview.vue'

const props = defineProps<{
  templates: ConstructionTemplate[]
  materials: Material[]
  busy: boolean
  templateDraft: ConstructionTemplate | null
  findings: Finding[]
  preview: ConstructionTemplate | null
  previewMissing: { index: number; materialId: string }[]
}>()
const emit = defineEmits<{
  blank: []
  edit: [id: string]
  remove: [id: string]
  preview: [id: string]
  closePreview: []
  apply: []
  cancelForm: []
  submitForm: []
  updateDraft: [patch: Partial<ConstructionTemplate>]
  updateLayer: [index: number, patch: Partial<TemplateLayer>]
  removeLayer: [index: number]
  moveLayer: [index: number, direction: -1 | 1]
  addLayer: [material: Material]
}>()

const query = shallowRef('')
const surface = shallowRef<Surface | ''>('')
const draftExisting = computed(() =>
  Boolean(
    props.templateDraft && props.templates.some((item) => item.id === props.templateDraft!.id),
  ),
)
const visible = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return props.templates.filter(
    (template) =>
      (!surface.value || template.surface === surface.value) &&
      (!needle || `${template.name} ${template.usage}`.toLocaleLowerCase().includes(needle)),
  )
})
</script>

<template>
  <section class="template-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">构造模板</span>
        <h1>常用做法，一次存好。</h1>
      </div>
      <button
        class="button primary"
        :disabled="busy || Boolean(templateDraft)"
        @click="emit('blank')"
      >
        ＋ 空白模板
      </button>
    </div>
    <p class="section-intro">
      模板保存材料、层顺序、厚度、损耗与替换寿命，不继承原构造的面积、名称、定稿状态或历史计算书。套用前先预览，生成的构造相互独立，修改模板不影响已生成的构造。
    </p>

    <TemplateForm
      v-if="templateDraft"
      :template="templateDraft"
      :existing="draftExisting"
      :materials="materials"
      :findings="findings"
      :busy="busy"
      @submit="emit('submitForm')"
      @cancel="emit('cancelForm')"
      @update-draft="emit('updateDraft', $event)"
      @update-layer="(index, patch) => emit('updateLayer', index, patch)"
      @remove-layer="emit('removeLayer', $event)"
      @move-layer="(index, direction) => emit('moveLayer', index, direction)"
      @add-layer="emit('addLayer', $event)"
    />

    <div class="template-filters">
      <label class="search-label"
        >查找模板<input
          v-model="query"
          type="search"
          placeholder="模板名称或使用说明"
      /></label>
      <label
        >适用部位
        <select v-model="surface">
          <option value="">全部部位</option>
          <option
            v-for="(label, key) in surfaceLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <span class="muted count">{{ visible.length }} / {{ templates.length }} 个模板</span>
    </div>

    <div
      v-if="visible.length"
      class="template-grid"
    >
      <TemplateCard
        v-for="template in visible"
        :key="template.id"
        :template="template"
        :materials="materials"
        :busy="busy"
        @preview="emit('preview', template.id)"
        @edit="emit('edit', template.id)"
        @remove="emit('remove', template.id)"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      没有符合条件的模板。可在构造编辑中把当前做法「存为构造模板」，或新建空白模板逐层添加。
    </div>

    <TemplatePreview
      v-if="preview"
      :template="preview"
      :materials="materials"
      :missing="previewMissing"
      :busy="busy"
      @apply="emit('apply')"
      @close="emit('closePreview')"
    />
  </section>
</template>

<style scoped>
.template-filters {
  display: flex;
  gap: 16px;
  align-items: end;
  margin: 24px 0;
}
.search-label {
  flex: 1;
  max-width: 440px;
}
.count {
  padding-bottom: 12px;
  margin-left: auto;
  font-size: 11px;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
@media (max-width: 900px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .template-filters {
    flex-direction: column;
    align-items: stretch;
  }
  .count {
    margin-left: 0;
  }
}
</style>
