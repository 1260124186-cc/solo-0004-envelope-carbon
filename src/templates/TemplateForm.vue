<script setup lang="ts">
import { computed } from 'vue'
import type { ConstructionTemplate, TemplateLayer } from './types'
import type { Surface, Finding } from '../assemblies/types'
import { surfaceLabels } from '../assemblies/types'
import type { Material } from '../materials/types'
import TemplateLayerRow from './TemplateLayerRow.vue'
import MaterialPicker from '../materials/MaterialPicker.vue'
import { missingTemplateMaterials } from './validation'
const props = defineProps<{
  template: ConstructionTemplate
  existing: boolean
  materials: Material[]
  findings: Finding[]
  busy: boolean
}>()
const emit = defineEmits<{
  submit: []
  cancel: []
  updateDraft: [patch: Partial<ConstructionTemplate>]
  updateLayer: [index: number, patch: Partial<TemplateLayer>]
  removeLayer: [index: number]
  moveLayer: [index: number, direction: -1 | 1]
  addLayer: [material: Material]
}>()
const isEditing = computed(() => props.existing)
const missing = computed(() => missingTemplateMaterials(props.template.layers, props.materials))
</script>

<template>
  <form
    class="template-form"
    @submit.prevent="emit('submit')"
  >
    <div class="section-heading">
      <h2>{{ isEditing ? '修改构造模板' : '保存为构造模板' }}</h2>
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
      class="template-meta"
      :disabled="busy"
    >
      <legend class="sr-only">模板信息</legend>
      <label
        >模板名称
        <input
          :value="template.name"
          required
          maxlength="50"
          placeholder="如：岩棉外墙标准做法"
          @input="emit('updateDraft', { name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label
        >适用部位
        <select
          :value="template.surface"
          @change="
            emit('updateDraft', { surface: ($event.target as HTMLSelectElement).value as Surface })
          "
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
      <label class="wide"
        >使用说明
        <textarea
          rows="3"
          required
          maxlength="500"
          placeholder="适用范围、层序意图、需要按项目调整的厚度或注意事项"
          :value="template.usage"
          @input="emit('updateDraft', { usage: ($event.target as HTMLTextAreaElement).value })"
        ></textarea>
      </label>
    </fieldset>

    <div class="section-heading layer-heading">
      <h3>材料层组合（室外到室内）</h3>
      <span class="muted">{{ template.layers.length }} / 20 层</span>
    </div>
    <p
      v-if="!template.layers.length"
      class="empty-state"
    >
      模板还没有材料层。
    </p>
    <TemplateLayerRow
      v-for="(layer, index) in template.layers"
      :key="`${layer.materialId}-${index}`"
      :layer="layer"
      :index="index"
      :total="template.layers.length"
      :materials="materials"
      @update="(patch) => emit('updateLayer', index, patch)"
      @remove="emit('removeLayer', index)"
      @move="(direction) => emit('moveLayer', index, direction)"
    />
    <MaterialPicker
      :materials="materials"
      :disabled="busy || template.layers.length >= 20"
      @add="emit('addLayer', $event)"
    />

    <p
      v-if="missing.length"
      class="inline-warning"
      role="alert"
    >
      {{
        missing.map((item) => `第 ${item.index} 层`).join('、')
      }}引用的材料已不可用，保存后该模板将无法直接套用，请先改层或恢复材料。
    </p>
    <ul
      v-if="findings.length"
      class="form-issues"
    >
      <li
        v-for="finding in findings"
        :key="`${finding.path}-${finding.text}`"
      >
        {{ finding.text }}
      </li>
    </ul>
    <p class="muted form-help">
      模板只保存材料、层顺序、厚度、损耗与替换寿命；不继承原构造的面积、名称、定稿状态或历史计算书。修改模板不会影响已由它生成的构造。
    </p>
    <button
      class="button primary"
      type="submit"
      :disabled="busy || findings.length > 0"
    >
      {{ isEditing ? '保存模板修改' : '保存构造模板' }}
    </button>
  </form>
</template>

<style scoped>
.template-form {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.template-meta {
  border: 0;
  padding: 0;
  margin: 18px 0 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
.layer-heading {
  margin: 24px 0 14px;
}
.form-help {
  font-size: 11px;
  margin: 16px 0;
  line-height: 1.8;
}
.form-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
  margin: 8px 0;
}
@media (max-width: 600px) {
  .template-meta {
    grid-template-columns: 1fr;
  }
}
</style>
