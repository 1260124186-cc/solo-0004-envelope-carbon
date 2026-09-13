<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Evidence, EvidenceLink, EvidenceStatus, PropertyKey } from './types'
import { propertyLabels, statusLabels, statusOrder } from './types'
import type { Material } from '../materials/types'
import { emptyLink, propertyKeys, validateEvidenceInput } from './validation'
const props = defineProps<{
  busy: boolean
  materials: Material[]
  presetMaterialId?: string
  submitEvidence: (evidence: Evidence) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()

function blankLinks(): EvidenceLink[] {
  return props.materials.length ? [emptyLink(props.materials[0])] : []
}

const form = reactive<Evidence>({
  id: '',
  title: '',
  year: String(new Date().getFullYear()),
  url: '',
  scope: '',
  note: '',
  status: 'pending',
  links: blankLinks(),
  createdAt: '',
  updatedAt: '',
})

// 从材料卡「登记依据」进入时预选该材料；之后由用户自行决定关联。
watch(
  () => props.presetMaterialId,
  (id) => {
    if (id && props.materials.some((material) => material.id === id)) {
      form.links = [emptyLink(props.materials.find((material) => material.id === id)!)]
    }
  },
  { immediate: true },
)
const issues = computed(() => validateEvidenceInput(form, props.materials))

function addLink() {
  const candidate = props.materials.find(
    (material) => !form.links.some((link) => link.materialId === material.id),
  )
  if (candidate) form.links.push(emptyLink(candidate))
}
function removeLink(index: number) {
  form.links.splice(index, 1)
}
function toggleProperty(link: EvidenceLink, key: PropertyKey, checked: boolean) {
  const next = new Set(link.properties)
  if (checked) next.add(key)
  else next.delete(key)
  link.properties = propertyKeys.filter((item) => next.has(item))
}
async function submit() {
  if (issues.value.length || props.busy) return
  if (await props.submitEvidence({ ...form, links: form.links.map((link) => ({ ...link })) }))
    emit('cancel')
}
</script>

<template>
  <form
    class="evidence-form panel"
    @submit.prevent="submit"
  >
    <div class="section-heading">
      <h2>登记物性依据</h2>
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
      这里只登记资料的文字信息与来源网址，不下载资料、不上传附件，也不做在线验证。保存依据不会修改任何材料数值。
    </p>
    <fieldset
      class="evidence-fields"
      :disabled="busy"
    >
      <legend class="sr-only">物性依据信息</legend>
      <label
        >资料名称<input
          v-model="form.title"
          required
          maxlength="80"
          placeholder="如：结构混凝土与保温材料碳排放数据集"
      /></label>
      <label
        >年份<input
          v-model="form.year"
          required
          inputmode="numeric"
          maxlength="4"
          placeholder="四位年份，如 2024"
      /></label>
      <label class="wide"
        >来源网址（可选）<input
          v-model="form.url"
          type="url"
          maxlength="300"
          placeholder="https://… 仅登记，不在应用内自动校验"
      /></label>
      <label class="wide"
        >适用材料范围<input
          v-model="form.scope"
          required
          maxlength="200"
          placeholder="如：干密度 500–700 千克/立方米的蒸压加气混凝土砌块"
      /></label>
      <label class="wide"
        >补充说明<textarea
          v-model="form.note"
          rows="2"
          maxlength="500"
          placeholder="适用边界、数据口径、与本模型的差异等"
        />
      </label>
      <label class="wide"
        >核实状态
        <select v-model="form.status">
          <option
            v-for="status in statusOrder"
            :key="status"
            :value="status as EvidenceStatus"
          >
            {{ statusLabels[status] }}
          </option>
        </select>
      </label>
    </fieldset>

    <fieldset
      class="evidence-links"
      :disabled="busy"
    >
      <legend>关联材料物性（至少一项）</legend>
      <p class="muted link-help">一条依据可覆盖多种材料；每种材料可只勾选其支持的物性。</p>
      <div
        v-for="(link, index) in form.links"
        :key="index"
        class="link-row"
      >
        <label class="link-material"
          >材料
          <select v-model="link.materialId">
            <option
              v-for="material in materials"
              :key="material.id"
              :value="material.id"
              :disabled="
                form.links.some((other) => other !== link && other.materialId === material.id)
              "
            >
              {{ material.name }}
            </option>
          </select>
        </label>
        <div
          class="link-properties"
          role="group"
          :aria-label="`第 ${index + 1} 条关联的物性`"
        >
          <label
            v-for="key in propertyKeys"
            :key="key"
            class="property-check"
          >
            <input
              type="checkbox"
              :checked="link.properties.includes(key)"
              @change="toggleProperty(link, key, ($event.target as HTMLInputElement).checked)"
            />
            {{ propertyLabels[key] }}
          </label>
        </div>
        <button
          type="button"
          class="icon-button remove"
          :disabled="form.links.length <= 1"
          :aria-label="`移除第 ${index + 1} 条关联`"
          @click="removeLink(index)"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="button small"
        :disabled="form.links.length >= materials.length"
        @click="addLink"
      >
        ＋ 关联另一种材料
      </button>
    </fieldset>

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
      保存依据（不改写材料数值）
    </button>
  </form>
</template>

<style scoped>
.evidence-form {
  margin: 20px 0 28px;
  background: #f4f7f1;
  border-color: #d1dfd4;
}
.evidence-fields {
  border: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.wide {
  grid-column: 1 / -1;
}
.evidence-links {
  border: 1px dashed #b9c8bf;
  border-radius: 6px;
  padding: 16px;
  margin: 20px 0;
}
.evidence-links legend {
  font-size: 12px;
  padding: 0 6px;
}
.link-help {
  font-size: 11px;
  margin: 4px 0 12px;
}
.link-row {
  display: grid;
  grid-template-columns: minmax(180px, 260px) 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 10px 0;
}
.link-properties {
  display: flex;
  gap: 16px;
}
.property-check {
  display: flex;
  grid-auto-flow: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.property-check input {
  width: auto;
}
.icon-button {
  border: 0;
  background: transparent;
  padding: 7px 9px;
  color: var(--muted);
}
.remove {
  color: #a34f3a;
}
.form-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
}
@media (max-width: 700px) {
  .evidence-fields {
    grid-template-columns: 1fr;
  }
  .link-row {
    grid-template-columns: 1fr;
  }
}
</style>
