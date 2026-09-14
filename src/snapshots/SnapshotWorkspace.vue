<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import type { Assembly } from '../assemblies/types'
import type { Material } from '../materials/types'
import type { PhaseSnapshot, SnapshotInput } from './types'
import { stateLabels, surfaceLabels } from '../assemblies/types'
import { validateSnapshotInput } from './validation'
import { date } from '../shared/format'
import SnapshotSheet from './SnapshotSheet.vue'

const props = defineProps<{
  assemblies: Assembly[]
  materials: Material[]
  snapshots: PhaseSnapshot[]
  busy: boolean
  dirty: boolean
  submitSnapshot: (input: SnapshotInput) => Promise<boolean>
}>()
const emit = defineEmits<{ design: [] }>()

const form = reactive<SnapshotInput>({ name: '', note: '', assemblyIds: [] })
const issues = computed(() => validateSnapshotInput(form, props.assemblies))

const ordered = computed(() => [...props.snapshots].reverse())
const selectedId = shallowRef('')
watch(
  [ordered, selectedId],
  () => {
    if (!ordered.value.some((snapshot) => snapshot.id === selectedId.value)) {
      selectedId.value = ordered.value[0]?.id ?? ''
    }
  },
  { immediate: true },
)
const selected = computed(() => ordered.value.find((snapshot) => snapshot.id === selectedId.value))

async function submit() {
  if (issues.value.length || props.busy) return
  const saved = await props.submitSnapshot({ ...form, assemblyIds: [...form.assemblyIds] })
  if (saved) {
    form.name = ''
    form.note = ''
    form.assemblyIds = []
    selectedId.value = ''
  }
}
</script>

<template>
  <section class="panel snapshot-workspace">
    <div class="section-heading">
      <div>
        <span class="eyebrow">阶段留存</span>
        <h1>方案推进，给阶段留张底。</h1>
      </div>
    </div>
    <p class="section-intro">
      阶段快照把勾选构造当时的部位、面积、年限、构造层与材料物性，整体留存为同一时刻的记录，供方案推进中随时回看。
      它只是阶段记录：不改变构造状态、不生成计算书；需要正式冻结与下载时，请使用计算书定稿。
    </p>
    <p
      v-if="dirty"
      class="inline-warning"
    >
      编辑区有未保存修改，快照只记录最近保存的构造版本。
    </p>
    <div
      v-if="!assemblies.length"
      class="empty-state"
    >
      <h2>还没有可留存的构造</h2>
      <p>先在构造编辑中保存至少一个构造，再回来生成阶段快照。</p>
      <button
        class="button primary"
        @click="emit('design')"
      >
        返回构造编辑
      </button>
    </div>
    <template v-else>
      <form
        class="snapshot-form"
        @submit.prevent="submit"
      >
        <fieldset
          class="snapshot-form-fields"
          :disabled="busy"
        >
          <legend class="sr-only">新建阶段快照</legend>
          <label
            >阶段名称<input
              v-model="form.name"
              required
              maxlength="50"
              placeholder="例如：方案比选 · 第一轮"
          /></label>
          <label
            >阶段说明（可选）<textarea
              v-model="form.note"
              rows="2"
              maxlength="500"
              placeholder="记录本阶段的比选背景，不写也可生成"
            />
          </label>
          <div
            class="snapshot-choices"
            role="group"
            aria-label="选择纳入快照的构造"
          >
            <span class="choices-label">
              纳入构造（已选 {{ form.assemblyIds.length }} / {{ assemblies.length }}）
            </span>
            <label
              v-for="item in assemblies"
              :key="item.id"
              class="snapshot-choice"
            >
              <input
                v-model="form.assemblyIds"
                type="checkbox"
                :value="item.id"
              />
              <span class="choice-name"
                >{{ item.name }}
                <small>
                  {{ surfaceLabels[item.surface] }} · {{ stateLabels[item.state] }} · 修订
                  {{ item.revision }}
                </small>
              </span>
            </label>
          </div>
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
          生成阶段快照
        </button>
      </form>
      <div
        v-if="ordered.length"
        class="snapshot-history"
      >
        <label class="snapshot-version"
          >已保存的阶段快照
          <select v-model="selectedId">
            <option
              v-for="snapshot in ordered"
              :key="snapshot.id"
              :value="snapshot.id"
            >
              {{ snapshot.name }} · {{ date(snapshot.createdAt) }}
            </option>
          </select>
        </label>
        <SnapshotSheet
          v-if="selected"
          :snapshot="selected"
          :assemblies="assemblies"
          :materials="materials"
        />
      </div>
      <p
        v-else
        class="muted snapshot-empty-note"
      >
        还没有阶段快照。生成后可在此随时重开查看，快照内容不随原构造或材料的后续修改而改变。
      </p>
    </template>
  </section>
</template>

<style scoped>
.snapshot-workspace {
  max-width: 1100px;
  margin: 0 auto;
}
.snapshot-form {
  background: #f4f7f1;
  border: 1px solid #d1dfd4;
  padding: 24px;
  border-radius: 6px;
  margin: 24px 0;
}
.snapshot-form-fields {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
}
.snapshot-choices {
  display: grid;
  gap: 8px;
}
.choices-label {
  color: #727969;
  font-size: 11px;
}
.snapshot-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
}
.snapshot-choice input {
  width: auto;
  flex: none;
}
.choice-name {
  display: grid;
  gap: 2px;
}
.choice-name small {
  color: var(--muted);
  font-size: 10px;
}
.form-issues {
  font-size: 11px;
  color: #855123;
  padding-left: 18px;
}
.snapshot-history {
  margin-top: 32px;
}
.snapshot-version {
  max-width: 420px;
  margin-bottom: 24px;
}
.snapshot-empty-note {
  font-size: 12px;
  text-align: center;
  padding: 24px 0 8px;
}
</style>
